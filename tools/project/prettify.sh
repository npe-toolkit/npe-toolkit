#!/bin/bash
#
# Script to format all the files in the repo

SCRIPTDIR=$(dirname $0)
BASEDIR=$(cd $SCRIPTDIR/../.. && echo $PWD)

echo Installing tools
cd $BASEDIR/tools/project && yarn install

echo Running prettier across the code base
yarn prettier -w $BASEDIR/**/*.{ts,tsx}
