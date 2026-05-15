const { pool } = require('../db');
const registerService = require('../services/register.service');
const fs = require('fs/promises');
const path = require('path');

const DOG_PHOTO_BUCKET = process.env.SUPABASE_DOG_PHOTO_BUCKET || process.env.SUPABASE_PUBLIC_BUCKET || 'logos';
const SUPPORTED_DOG_PHOTO_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

async function ensureDogsSchema() {
    await pool.query('ALTER TABLE dogs ADD COLUMN IF NOT EXISTS photo_url TEXT').catch(() => {});
}

function normalizeOptional(value) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized.length ? normalized : null;
}

function normalizeSex(value) {
    const normalized = normalizeOptional(value);
    return ['M', 'F'].includes(normalized) ? normalized : null;
}

function normalizeDate(value) {
    return normalizeOptional(value) || null;
}

function buildDogPhotoName(breederId, file) {
    const ext = SUPPORTED_DOG_PHOTO_TYPES[file.mimetype] || 'jpg';
    const safeBreederId = String(breederId).replace(/[^a-zA-Z0-9-]/g, '');
    return `dogs/${safeBreederId}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
}

async function uploadDogPhoto(breederId, file) {
    if (!file) return null;
    if (!SUPPORTED_DOG_PHOTO_TYPES[file.mimetype]) {
        throw new Error('Format de photo non supporte.');
    }

    const fileName = buildDogPhotoName(breederId, file);

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        const supabase = require('../utils/supabase');
        const { error } = await supabase.storage
            .from(DOG_PHOTO_BUCKET)
            .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

        if (!error) {
            const { data } = supabase.storage.from(DOG_PHOTO_BUCKET).getPublicUrl(fileName);
            return data.publicUrl;
        }

        console.warn('Upload Supabase indisponible, fallback local:', error.message);
    }

    const uploadRoot = path.join(__dirname, '..', 'public', 'uploads', 'dogs');
    await fs.mkdir(uploadRoot, { recursive: true });
    const localName = path.basename(fileName);
    await fs.writeFile(path.join(uploadRoot, localName), file.buffer);
    return `/uploads/dogs/${localName}`;
}

function dogInitials(name) {
    return String(name || 'Chien')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

function buildDogCompleteness(dog) {
    const items = [
        ['Identite', dog.name && dog.sex && dog.breed],
        ['Photo', dog.photo_url],
        ['Naissance', dog.birth_date],
        ['Identification', dog.chip_number || dog.id_scc],
        ['LOF / pedigree', dog.lof || dog.pedigree_number],
        ['Genealogie', dog.father_name || dog.father_name_external || dog.mother_name || dog.mother_name_external],
        ['Observations', dog.notes],
    ];
    const completed = items.filter(([, done]) => Boolean(done)).length;

    return {
        completed,
        total: items.length,
        percent: Math.round((completed / items.length) * 100),
        missing: items.filter(([, done]) => !done).map(([label]) => label),
    };
}

async function columnExists(tableName, columnName) {
    const result = await pool.query(
        `
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = $1
                  AND column_name = $2
            ) AS exists
        `,
        [tableName, columnName],
    );

    return Boolean(result.rows[0]?.exists);
}

async function getDogOptionalColumns() {
    const [hasLof, hasFatherNameExternal, hasMotherNameExternal] = await Promise.all([
        columnExists('dogs', 'lof'),
        columnExists('dogs', 'father_name_external'),
        columnExists('dogs', 'mother_name_external'),
    ]);

    return { hasLof, hasFatherNameExternal, hasMotherNameExternal };
}

async function getLitterMotherColumn() {
    if (await columnExists('litters', 'mother_id')) return 'mother_id';
    if (await columnExists('litters', 'female_id')) return 'female_id';
    return null;
}

async function getLitterCountExpression() {
    if (await columnExists('litters', 'puppies_count_total')) return 'puppies_count_total';
    if (await columnExists('litters', 'puppies_count')) return 'puppies_count';
    if (await columnExists('litters', 'nb_puppies')) return 'nb_puppies';
    return 'NULL';
}

exports.listDogs = async (req, res) => {
    try {
        await ensureDogsSchema();
        const breederId = req.session.user.breeder_id;
        const result = await pool.query('SELECT * FROM dogs WHERE breeder_id = $1 ORDER BY name ASC', [breederId]);
        res.render('dogs/index', { dogs: result.rows, dogInitials });
    } catch (error) {
        console.error('Erreur chargement chiens:', error);
        res.status(500).send('Erreur chargement.');
    }
};

exports.showDog = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;
        await ensureDogsSchema();

        const dogRes = await pool.query(
            `
                SELECT
                    d.*,
                    father.name AS father_name,
                    mother.name AS mother_name
                FROM dogs d
                LEFT JOIN dogs father ON d.father_id = father.id
                LEFT JOIN dogs mother ON d.mother_id = mother.id
                WHERE d.id = $1
                  AND d.breeder_id = $2
            `,
            [dogId, breederId],
        );

        if (dogRes.rows.length === 0) {
            return res.status(404).render('errors/404', {
                title: res.__ ? res.__('errors.notFound') : 'Page introuvable',
                user: req.session?.user || null,
            });
        }

        const soins = await pool.query(
            `
                SELECT id, type, label, event_date, next_due, notes
                FROM soins
                WHERE breeder_id = $1
                  AND dog_id = $2
                ORDER BY event_date DESC NULLS LAST
                LIMIT 20
            `,
            [breederId, dogId],
        );

        const hasReminderCompletedColumn = await columnExists('reminders', 'is_completed');
        const reminderCompletedFilter = hasReminderCompletedColumn ? 'AND COALESCE(is_completed, false) = false' : '';
        const reminders = await pool.query(
            `
                SELECT id, title, due_date, type
                FROM reminders
                WHERE breeder_id = $1
                  AND dog_id = $2
                  ${reminderCompletedFilter}
                ORDER BY due_date ASC
                LIMIT 20
            `,
            [breederId, dogId],
        );

        const litterMotherColumn = await getLitterMotherColumn();
        const litterCountExpression = await getLitterCountExpression();

        let litters = { rows: [] };
        let puppies = { rows: [] };

        if (litterMotherColumn) {
            litters = await pool.query(
                `
                    SELECT id, birth_date, ${litterCountExpression} AS puppies_count_total, notes
                    FROM litters
                    WHERE breeder_id = $1
                      AND ${litterMotherColumn} = $2
                    ORDER BY birth_date DESC NULLS LAST
                    LIMIT 20
                `,
                [breederId, dogId],
            );

            puppies = await pool.query(
                `
                    SELECT p.id, p.name, p.sex, p.status, p.chip_number, p.color, p.created_at
                    FROM puppies p
                    INNER JOIN litters l ON p.litter_id = l.id
                    WHERE p.breeder_id = $1
                      AND l.${litterMotherColumn} = $2
                    ORDER BY p.created_at DESC NULLS LAST, p.name ASC NULLS LAST
                    LIMIT 50
                `,
                [breederId, dogId],
            );
        }

        return res.render('dogs/show', {
            dog: dogRes.rows[0],
            completeness: buildDogCompleteness(dogRes.rows[0]),
            dogInitials,
            soins: soins.rows,
            reminders: reminders.rows,
            litters: litters.rows,
            puppies: puppies.rows,
            user: req.session.user,
        });
    } catch (error) {
        console.error('Erreur fiche chien:', error);
        return res.status(500).send('Erreur lors du chargement de la fiche chien.');
    }
};

exports.getForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;
        let dog = { status: 'actif' };
        await ensureDogsSchema();

        if (dogId) {
            const dogRes = await pool.query('SELECT * FROM dogs WHERE id = $1 AND breeder_id = $2', [dogId, breederId]);
            if (dogRes.rows.length > 0) dog = dogRes.rows[0];
        }

        const excludeCondition = dogId ? `AND id != $2` : '';
        const queryParams = dogId ? [breederId, dogId] : [breederId];

        const males = await pool.query(`SELECT id, name, breed FROM dogs WHERE breeder_id = $1 AND sex = 'M' ${excludeCondition} ORDER BY name ASC`, queryParams);
        const females = await pool.query(`SELECT id, name, breed FROM dogs WHERE breeder_id = $1 AND sex = 'F' ${excludeCondition} ORDER BY name ASC`, queryParams);

        res.render('dogs/form', { dog, males: males.rows, females: females.rows, dogInitials });
    } catch (error) {
        console.error('Erreur formulaire chien:', error);
        res.status(500).send('Erreur serveur.');
    }
};

exports.saveDog = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;
        await ensureDogsSchema();

        let {
            name,
            sex,
            breed,
            birth_date,
            chip_number,
            id_scc,
            pedigree_number,
            lof,
            status,
            notes,
            father_id,
            mother_id,
            father_name_external,
            mother_name_external,
        } = req.body;

        name = normalizeOptional(name);
        sex = normalizeSex(sex);
        breed = normalizeOptional(breed);
        birth_date = normalizeDate(birth_date);
        chip_number = normalizeOptional(chip_number);
        id_scc = normalizeOptional(id_scc);
        pedigree_number = normalizeOptional(pedigree_number) || normalizeOptional(lof);
        lof = normalizeOptional(lof);
        status = normalizeOptional(status) || 'actif';
        notes = normalizeOptional(notes);
        father_id = normalizeOptional(father_id);
        mother_id = normalizeOptional(mother_id);
        father_name_external = father_id ? null : normalizeOptional(father_name_external);
        mother_name_external = mother_id ? null : normalizeOptional(mother_name_external);

        if (!name) {
            return res.status(400).send('Le nom du chien est obligatoire.');
        }

        if (!sex) {
            return res.status(400).send('Le sexe du chien doit être M ou F.');
        }

        const optionalColumns = await getDogOptionalColumns();
        const uploadedPhotoUrl = await uploadDogPhoto(breederId, req.file);
        let photoUrl = uploadedPhotoUrl;

        if (dogId && !uploadedPhotoUrl) {
            const currentDog = await pool.query('SELECT photo_url FROM dogs WHERE id = $1 AND breeder_id = $2', [dogId, breederId]);
            photoUrl = req.body.remove_photo === 'on' ? null : (currentDog.rows[0]?.photo_url || null);
        }

        const dogData = {
            name,
            sex,
            breed,
            birth_date,
            chip_number,
            id_scc,
            pedigree_number,
            status,
            notes,
            father_id,
            mother_id,
            photo_url: photoUrl,
        };

        if (optionalColumns.hasLof) dogData.lof = lof;
        if (optionalColumns.hasFatherNameExternal) dogData.father_name_external = father_name_external;
        if (optionalColumns.hasMotherNameExternal) dogData.mother_name_external = mother_name_external;

        if (dogId) {
            const entries = Object.entries(dogData);
            const setClause = entries.map(([column], index) => `${column} = $${index + 1}`).join(', ');
            const values = entries.map(([, value]) => value);
            values.push(dogId, breederId);

            await pool.query(
                `
                    UPDATE dogs
                    SET ${setClause}, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $${values.length - 1}
                      AND breeder_id = $${values.length}
                `,
                values,
            );
        } else {
            const entries = Object.entries({ breeder_id: breederId, ...dogData });
            const columns = entries.map(([column]) => column).join(', ');
            const placeholders = entries.map((_, index) => `$${index + 1}`).join(', ');
            const values = entries.map(([, value]) => value);

            await pool.query(
                `INSERT INTO dogs (${columns}) VALUES (${placeholders})`,
                values,
            );

            try {
                await registerService.logMovement({
                    breederId,
                    animalName: name,
                    identification: chip_number,
                    breed: breed || 'Non renseignée',
                    type: 'ENTREE',
                    reason: 'Acquisition',
                    date: new Date(),
                });
            } catch (registerError) {
                console.warn('Registre légal non mis à jour après création du chien:', registerError.message);
            }
        }

        return res.redirect('/dogs');
    } catch (error) {
        console.error('Erreur sauvegarde chien:', error);
        return res.status(500).send(`Erreur sauvegarde chien : ${error.message}`);
    }
};

exports.deleteDog = async (req, res) => {
    try {
        await pool.query('DELETE FROM dogs WHERE id = $1 AND breeder_id = $2', [req.params.id, req.session.user.breeder_id]);
        res.redirect('/dogs');
    } catch (error) {
        console.error('Erreur suppression chien:', error);
        res.status(500).send('Erreur suppression.');
    }
};
