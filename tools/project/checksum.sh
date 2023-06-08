#!/bin/bash
#
# Checksum yarn.lock files for smoke test cache key

SCRIPTDIR=$(dirname $0)
BASEDIR=$(cd $SCRIPTDIR/../.. && echo $PWD)
echo Creating checksums at /tmp/tkchecksum.txt for $BASEDIR

shasum $BASEDIR/tools/project/yarn.lock \
  $BASEDIR/deps/v47/yarn.lock \
  $BASEDIR/deps/v47/server/yarn.lock > /tmp/tkchecksum.txt
