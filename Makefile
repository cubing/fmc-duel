SFTP_PATH      = "towns.dreamhost.com:~/fmc-duel.cubing.net/"
URL            = "https://fmc-duel.cubing.net/"

.PHONY: build
build:
	npx parcel build --public-url ./ src/index.html

.PHONY: dev
dev:
	npx parcel src/index.html

.PHONY: clean
clean:
	rm -rf ./dist/

.PHONY: deploy
deploy: clean build
	rsync -avz \
		--exclude .DS_Store \
		--exclude .git \
		./dist/ \
		${SFTP_PATH}
	echo "\nDone deploying. Go to ${URL}\n"

.PHONY: open
open:
	open ${URL}
