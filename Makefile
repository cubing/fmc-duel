.PHONY: build
build:
	npx parcel build src/index.html

.PHONY: dev
dev:
	npx parcel src/index.html
