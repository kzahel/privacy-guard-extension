rm package.zip

zip package.zip -r * -x package.sh -x *.git* -x "*.*~" -x js/*override* -x extension/* -x extension/cws/* -x cws/* -x JS-LOGO* -x scratch.js -x manifest.json.scratch -x manifest_app.json

