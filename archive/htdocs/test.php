<?php
$hash = '$2y$10$wc/P4kd4mhMjIHmpgoh0ze5k6pGkmotUlGd9PQgkm655jfFDm32f.'; // colle ici ton password_hash de la BDD
$ok = password_verify('NarutO3662!', $hash);
var_dump($ok);