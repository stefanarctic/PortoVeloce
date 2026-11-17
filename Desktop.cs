using System;
using System.IO;
using System.Windows;
using System.Windows.Media;
using System.Windows.Input;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

public class PortoVeloce : Application {
    [STAThread] public static void Main() { new PortoVeloce().Run(new DriveWindow()); }
}
public class DriveWindow : Window {
    WebView2 view = new WebView2();
    bool fullscreen;
    WindowState oldState;
    public DriveWindow() {
        Title = "Porto Veloce";
        Width = 1440; Height = 900; MinWidth = 820; MinHeight = 540;
        WindowState = WindowState.Maximized;
        Background = Brushes.Black; Content = view;
        Loaded += Start;
        Closed += delegate { view.Dispose(); };
    }
    async void Start(object sender, RoutedEventArgs args) {
        try {
            string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PortoVeloce", "Profile");
            var env = await CoreWebView2Environment.CreateAsync(null, data, null);
            await view.EnsureCoreWebView2Async(env);
            var core = view.CoreWebView2;
            core.SetVirtualHostNameToFolderMapping("drive.portoveloce.local", Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "game"), CoreWebView2HostResourceAccessKind.DenyCors);
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.AreBrowserAcceleratorKeysEnabled = false;
            core.WebMessageReceived += delegate(object o, CoreWebView2WebMessageReceivedEventArgs e) {
                if (new Uri(e.Source).Host != "drive.portoveloce.local") return;
                string command = e.TryGetWebMessageAsString();
                if (command == "quit") Close();
                if (command == "fullscreen") {
                    if (!fullscreen) { oldState = WindowState; WindowState = WindowState.Normal; WindowStyle = WindowStyle.None; WindowState = WindowState.Maximized; }
                    else { WindowStyle = WindowStyle.SingleBorderWindow; WindowState = oldState; }
                    fullscreen = !fullscreen;
                }
            };
            core.Navigate("https://drive.portoveloce.local/index.html"); view.Focus();
        } catch (Exception e) {
            MessageBox.Show("The game could not start. It requires Windows x64 and Microsoft Edge WebView2 Runtime.\n\n" + e.Message, "Porto Veloce"); Close();
        }
    }
}
