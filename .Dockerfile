# 1. Utiliser l'image officielle PHP 8.2 avec Apache
FROM php:8.2-apache

# 2. Installer les dépendances système requises pour PostgreSQL
RUN apt-get update && apt-get install -y \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 3. Installer et activer les extensions PHP spécifiques pour communiquer avec PostgreSQL
RUN docker-php-ext-install pdo pdo_pgsql pgsql

# 4. Activer le module de réécriture d'URL d'Apache (vital pour ton fichier .htaccess)
RUN a2enmod rewrite

# 5. Sécuriser l'application : modifier le DocumentRoot pour pointer uniquement sur /public
ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# 6. Copier l'intégralité du code source dans le serveur web
COPY . /var/www/html/

# 7. Donner les droits d'exécution corrects au serveur web (utilisateur www-data)
RUN chown -R www-data:www-data /var/www/html