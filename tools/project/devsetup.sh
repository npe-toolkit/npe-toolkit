#!/bin/bash
#
# Script to yarn install all directories in the toolkit

SCRIPTDIR=$(dirname $0)
BASEDIR=$(cd $SCRIPTDIR/../.. && echo $PWD)

echo Calling \`yarn install\` on all directories
cd $BASEDIR && yarn install
cd $BASEDIR/tools/project && yarn install
cd $BASEDIR/deps/v47 && yarn install
cd $BASEDIR/deps/v47/server && yarn install
