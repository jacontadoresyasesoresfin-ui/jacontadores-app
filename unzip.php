<?php
$zip = new ZipArchive;
$res = $zip->open('deploy.zip');
if ($res === TRUE) {
  $zip->extractTo('./');
  $zip->close();
  echo 'Unzipped successfully!';
} else {
  echo 'Failed to unzip';
}

// Escribir el .htaccess forzado para Passenger
file_put_contents('.htaccess', "PassengerAppRoot \"/home/jacoqvzn/app.jacontadores.com\"
PassengerBaseURI \"/\"
PassengerNodejs \"/home/jacoqvzn/virtualenv/app.jacontadores.com/22/bin/node\"
PassengerAppType node
PassengerStartupFile server.js");
echo ' .htaccess written!';
?>
