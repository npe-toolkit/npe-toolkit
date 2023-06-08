#!/bin/bash
#
# Clean all of the generated files in the repo

SCRIPTDIR=$(dirname $0)
BASEDIR=$(cd $SCRIPTDIR/../.. && echo $PWD)

echo Clearing all generated files
rm -rf $BASEDIR/node_modules
rm -rf $BASEDIR/tools/project/node_modules
rm -rf $BASEDIR/deps/v47/node_modules
rm -rf $BASEDIR/deps/v47/server/node_modules
rm -rf $BASEDIR/deps/v47/ios/Pods
