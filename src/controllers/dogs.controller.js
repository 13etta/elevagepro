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
    await pool.query("ALTER TABLE dogs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'actif'").catch(() => {});
}

async function ensureDogMovementsSchema(dbClient = pool) {
    await dbClient.query(`
        CREATE TABLE IF NOT EXISTS dog_movements (
            id BIGSERIAL PRIMARY KEY,
            breeder_id BIGINT NULL,
            dog_id BIGINT NOT NULL,
            movement_type TEXT NOT NULL CHECK (movement_type IN ('ENTREE', 'SORTIE')),
            movement_date DATE NOT NULL,
            reason VARCHAR(255) NOT NULL,
            notes TEXT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    await dbClient.query('ALTER TABLE dog_movements ADD COLUMN IF NOT EXISTS breeder_id BIGINT NULL');
    await dbClient.query('ALTER TABLE dog_movements ADD COLUMN IF NOT EXISTS dog_id BIGINT');
    await dbClient.query("ALTER TABLE dog_movements ADD COLUMN IF NOT EXISTS movement_type TEXT");
    await dbClient.query('ALTER TABLE dog_movements ADD COLUMN IF NOT EXISTS movement_date DATE');
    await dbClient.query('ALTER TABLE dog_movements ADD COLUMN IF NOT EXISTS reason VARCHAR(255)');
    await dbClient.query('ALTER TABLE dog_movements ADD COLUMN IF NOT EXISTS notes TEXT NULL');
    await dbClient.query('ALTER TABLE dog_movements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()');

    await dbClient.query('CREATE INDEX IF NOT EXISTS idx_dog_movements_breeder_id ON dog_movements (breeder_id)');
    await dbClient.query('CREATE INDEX IF NOT EXISTS idx_dog_movements_dog_id ON dog_movements (dog_id)');
    await dbClient.query('CREATE INDEX IF NOT EXISTS idx_dog_movements_type ON dog_movements (movement_type)');
    await dbClient.query('CREATE INDEX IF NOT EXISTS idx_dog_movements_date ON dog_movements (movement_date)');
}

async function logDogMovement({ dbClient, breederId, dogId, movementType, movementDate, reason, notes }) {
    await ensureDogMovementsSchema(dbClient);
    await dbClient.query(
        `
            INSERT INTO dog_movements (breeder_id, dog_id, movement_type, movement_date, reason, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [breederId, dogId, movementType, movementDate, reason, notes || null],
    );
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

function normalizeMovementDate(value) {
    return normalizeOptional(value) || new Date().toISOString().slice(0, 10);
}

exports.listDogs = async (req, res) => {
    try {
        await ensureDogsSchema();
        const breederId = req.session.user.breeder_id;
        const optionalColumns = await getDogOptionalColumns();

        const filters = {
            q: normalizeOptional(req.query.q) || '',
            sex: normalizeOptional(req.query.sex) || '',
            breed: normalizeOptional(req.query.breed) || '',
            status: normalizeOptional(req.query.status) || 'active',
        };

        const where = ['breeder_id = $1'];
        const values = [breederId];

        if (filters.status === 'sorti') {
            where.push("LOWER(COALESCE(status, 'actif')) = 'sorti'");
        } else if (filters.status !== 'all') {
            where.push("LOWER(COALESCE(status, 'actif')) <> 'sorti'");
        }

        if (filters.q) {
            const searchableColumns = ['name', 'chip_number', 'id_scc', 'pedigree_number'];
            if (optionalColumns.hasLof) searchableColumns.push('lof');
            const clauses = searchableColumns.map((column) => `COALESCE(${column}::TEXT, '') ILIKE $${values.length + 1}`);
            where.push(`(${clauses.join(' OR ')})`);
            values.push(`%${filters.q}%`);
        }

        if (filters.sex) {
            values.push(filters.sex);
            where.push(`sex = $${values.length}`);
        }

        if (filters.breed) {
            values.push(filters.breed);
            where.push(`breed = $${values.length}`);
        }

        const [result, breedsResult] = await Promise.all([
            pool.query(`SELECT * FROM dogs WHERE ${where.join(' AND ')} ORDER BY name ASC`, values),
            pool.query(
                `
                    SELECT DISTINCT breed
                    FROM dogs
                    WHERE breeder_id = $1
                      AND breed IS NOT NULL
                      AND breed <> ''
                    ORDER BY breed ASC
                `,
                [breederId],
            ),
        ]);

        res.render('dogs/index', {
            dogs: result.rows,
            dogInitials,
            filters,
            query: req.query,
            breedOptions: breedsResult.rows.map((row) => row.breed),
        });
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

            const insertResult = await pool.query(
                `INSERT INTO dogs (${columns}) VALUES (${placeholders}) RETURNING id, name, chip_number, breed, created_at`,
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
                    sourceType: 'dog_creation',
                    sourceId: insertResult.rows[0]?.id,
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

exports.getDeleteForm = async (req, res) => {
    try {
        const breederId = req.session.user.breeder_id;
        const dogId = req.params.id;
        await ensureDogsSchema();

        const dogRes = await pool.query('SELECT * FROM dogs WHERE id = $1 AND breeder_id = $2', [dogId, breederId]);
        if (dogRes.rows.length === 0) {
            return res.status(404).render('errors/404', {
                title: res.__ ? res.__('errors.notFound') : 'Page introuvable',
                user: req.session?.user || null,
            });
        }

        return res.render('dogs/delete', {
            dog: dogRes.rows[0],
            errors: [],
            formData: {
                movement_date: new Date().toISOString().slice(0, 10),
                reason: '',
                notes: '',
            },
        });
    } catch (error) {
        console.error('Erreur formulaire sortie chien:', error);
        return res.status(500).send('Erreur lors du chargement du formulaire de sortie.');
    }
};

exports.deleteDog = async (req, res) => {
    const breederId = req.session.user.breeder_id;
    const dogId = req.params.id;
    const reason = normalizeOptional(req.body.reason);
    const notes = normalizeOptional(req.body.notes);
    const movementDate = normalizeMovementDate(req.body.movement_date);

    let dog = null;

    try {
        await ensureDogsSchema();
        const dogRes = await pool.query('SELECT * FROM dogs WHERE id = $1 AND breeder_id = $2', [dogId, breederId]);

        if (dogRes.rows.length === 0) {
            return res.status(404).render('errors/404', {
                title: res.__ ? res.__('errors.notFound') : 'Page introuvable',
                user: req.session?.user || null,
            });
        }

        dog = dogRes.rows[0];

        if (!reason) {
            return res.status(400).render('dogs/delete', {
                dog,
                errors: ['Le motif de sortie est obligatoire.'],
                formData: { movement_date: movementDate, reason: reason || '', notes: notes || '' },
            });
        }
    } catch (error) {
        console.error('Erreur verification sortie chien:', error);
        return res.status(500).send('Erreur lors de la préparation de la sortie.');
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query(
            `
                UPDATE dogs
                SET status = 'sorti', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                  AND breeder_id = $2
            `,
            [dogId, breederId],
        );

        await logDogMovement({
            dbClient: client,
            breederId,
            dogId,
            movementType: 'SORTIE',
            movementDate,
            reason,
            notes,
        });

        await registerService.logMovement({
            breederId,
            animalName: dog.name,
            identification: dog.chip_number || dog.id_scc || dog.lof,
            breed: dog.breed || 'Chien adulte',
            animalType: 'adulte',
            type: 'SORTIE',
            reason,
            date: movementDate,
            sourceType: 'dog_exit',
            sourceId: dogId,
            notes: notes || `Sortie administrative du chien ${dog.name}.`,
        }, client);

        await client.query('COMMIT');
        return res.redirect('/dogs?sortie=ok');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur sortie chien:', error);
        return res.status(500).render('dogs/delete', {
            dog,
            errors: ['Erreur lors de la sortie du chien. Aucune suppression physique n’a été réalisée.'],
            formData: { movement_date: movementDate, reason: reason || '', notes: notes || '' },
        });
    } finally {
        client.release();
    }
};
