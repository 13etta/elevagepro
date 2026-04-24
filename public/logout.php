<?php
require_once '../includes/helpers.php';
session_destroy();
redirect('/login.php');