@echo off
setlocal
set "target=D:\Projects\Games\PortoVeloce"
if /I "%~dp0"=="%target%\" goto run
if exist "%target%\" (
 echo The destination already exists. No files were overwritten.
 echo You can play the extracted copy by opening PortoVeloce.exe.
 pause
 exit /b 1
)
mkdir "%target%" || (pause & exit /b 1)
robocopy "%~dp0." "%target%" /E /R:1 /W:1 /NFL /NDL /NJH /NJS
if errorlevel 8 (echo Copy failed. See the destination for partially copied files. & pause & exit /b 1)
:run
start "" "%target%\PortoVeloce.exe"
