<?php
// Extract new bundle
shell_exec('cd /home/jacoqvzn/app.jacontadores.com && unzip -o static_bundle.zip 2>&1');

// Copy updated static assets
shell_exec('mkdir -p /home/jacoqvzn/app.jacontadores.com/_next/static');
shell_exec('cp -r /home/jacoqvzn/app.jacontadores.com/static/* /home/jacoqvzn/app.jacontadores.com/_next/static/');

// Fix permissions
shell_exec('chmod -R 755 /home/jacoqvzn/app.jacontadores.com/_next/static');

// Restart Passenger Node.js app
touch('/home/jacoqvzn/app.jacontadores.com/tmp/restart.txt');

echo 'Static assets update successful!';
?>
