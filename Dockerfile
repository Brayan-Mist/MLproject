FROM php:8.2-apache

RUN apt-get update \
    && docker-php-ext-install pdo_mysql \
    && (a2dismod mpm_event || true) \
    && (a2dismod mpm_worker || true) \
    && a2enmod mpm_prefork rewrite \
    && sed -ri "s/AllowOverride None/AllowOverride All/g" /etc/apache2/apache2.conf \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

COPY . /var/www/html
COPY docker/start.sh /usr/local/bin/railway-start

RUN chmod +x /usr/local/bin/railway-start \
    && mkdir -p /var/www/html/registration-form/uploads/img \
    && touch /var/www/html/registration-form/log_db.txt \
    && chown -R www-data:www-data /var/www/html/registration-form/uploads /var/www/html/registration-form/log_db.txt

EXPOSE 8080

ENTRYPOINT ["railway-start"]
