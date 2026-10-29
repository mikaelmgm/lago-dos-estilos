#!/bin/sh
# Monta o jogo num arquivo só: index.html = cabeçalho da página + as partes de src/, nesta ordem.
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="pt-BR">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  cat src/a-head.html src/b-core.js src/c-post.js src/d-sims.js src/e-worlds.js \
      src/g-native.js src/h-more.js src/i-extra.js src/j-batch.js src/k-batch.js \
      src/l-retro.js src/f-main.js
} > index.html
