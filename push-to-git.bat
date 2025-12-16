@echo off
echo Pushing Chat Platform Backend to Git...

cd /d "d:\Chat-Platform-Backend"

git add .
git commit -m "Backend with custom STOMP implementation for real-time messaging"
git push origin main

echo Backend pushed successfully!
pause