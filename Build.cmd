@echo off
setlocal
pushd "%~dp0"
set "framework=%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319"
"%framework%\csc.exe" /nologo /target:winexe /platform:x64 /optimize+ /out:PortoVeloce.exe /r:System.Xaml.dll /r:"%framework%\WPF\WindowsBase.dll" /r:"%framework%\WPF\PresentationCore.dll" /r:"%framework%\WPF\PresentationFramework.dll" /r:Microsoft.Web.WebView2.Core.dll /r:Microsoft.Web.WebView2.Wpf.dll Desktop.cs
set "status=%errorlevel%"
popd
exit /b %status%
