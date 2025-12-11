@echo off
echo Compiling and running Spring Boot application...
javac -cp "src/main/java" -d "target/classes" src/main/java/com/chatplatform/*.java src/main/java/com/chatplatform/*/*.java
if %errorlevel% neq 0 (
    echo Compilation failed. Please install Maven or use an IDE.
    pause
    exit /b 1
)
echo Starting application...
java -cp "target/classes" com.chatplatform.ChatApplication