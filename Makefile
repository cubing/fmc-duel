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
	bun x @cubing/deploy "fmc-duel.cubing.net"

.PHONY: open
open:
	open ${URL}
