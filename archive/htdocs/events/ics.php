<?php
require __DIR__ . '/../includes/config.php';
header('Content-Type: text/calendar; charset=utf-8');
header('Content-Disposition: attachment; filename="elevagepro.ics"');

$events = $pdo->query("SELECT title, date_time FROM events ORDER BY date_time ASC")->fetchAll();
echo "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ElevagePro//FR\r\n";
foreach ($events as $e) {
  $dt = new DateTime($e['date_time']);
  $stamp = $dt->format('Ymd\THis');
  $uid = md5($e['title'].$e['date_time'])."@elevagepro";
  echo "BEGIN:VEVENT\r\nUID:$uid\r\nDTSTAMP:$stamp\r\nDTSTART:$stamp\r\nSUMMARY:" . str_replace(["\r","\n"]," ",$e['title']) . "\r\nEND:VEVENT\r\n";
}
echo "END:VCALENDAR";
