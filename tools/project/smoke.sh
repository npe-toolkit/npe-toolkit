#!/bin/bash
#
# Script to smoke test the entire repo. Right now just does yarn install and tsc

SCRIPTDIR=$(dirname $0)
BASEDIR=$(cd $SCRIPTDIR/../.. && echo $PWD)
# ln -snf $BASEDIR $BASEDIR/templates/npe-toolkit

# TODO: Enable typechecking against a cloned version of favezilla Github repo

echo Calling \`yarn install\` on all directories
cd $BASEDIR && yarn install
cd $BASEDIR/tools/project && yarn install
cd $BASEDIR/deps/v47 && yarn install
cd $BASEDIR/deps/v47/server && yarn install

echo Typechecking all directories
STATUS=0
cd $BASEDIR/tools/project
echo Typechecking npe-toolkit/lib
yarn tsc -p $BASEDIR/lib --noEmit
STATUS=$(($STATUS + $?))
echo Typechecking deps/v47
yarn tsc -p $BASEDIR/deps/v47 --noEmit
STATUS=$(($STATUS + $?))

echo Status: $STATUS
if [ $STATUS -ne 0 ]; then
  echo "Failure in typechecking. See logs above to find errors and fix.." && \
  echo  "To run locally, call \`tools/project/smoke.sh\`"
  exit 1
fi