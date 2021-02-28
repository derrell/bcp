SERVER = derrell@bcp.unwireduniverse.com
TEST4000_DIR = ~/bcp-test
LIVE_DIR = ~/bcp
test4000 :
	npx qx deploy --out=deploy --clean
	rsync -av deploy/ ${SERVER}:${TEST4000_DIR}/

live :
	npx qx deploy --out=deploy --clean
	rsync -av deploy/ ${SERVER}:${LIVE_DIR}/

backup :
	rsync -av \
		${SERVER}:~/bcp-db.git \
		~/ME/billerica-community-pantry/bcp-db.git/
