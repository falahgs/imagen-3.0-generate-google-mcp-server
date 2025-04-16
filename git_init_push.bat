@echo off
echo Initializing Git repository...

REM Initialize a new Git repository
git init

REM Add README.md file
git add README.md

REM Commit the file
git commit -m "first commit"

REM Rename the default branch to main
git branch -M main

REM Add the remote origin
git remote add origin https://github.com/falahgs/image-gen3-google-mcp-server.git

REM Push to the remote repository
git push -u origin main

echo Git commands executed successfully.
pause
