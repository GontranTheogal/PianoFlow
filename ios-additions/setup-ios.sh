#!/bin/bash
# À lancer APRÈS `npx cap add ios` / `npx cap sync ios`, depuis la racine du projet (Mac, Codemagic ou GitHub Actions).
# Idempotent : on peut le relancer à chaque build.
set -euo pipefail
APP=ios/App/App

cp ios-additions/CoreMidiPlugin.swift ios-additions/MainViewController.swift "$APP/"

# 1. Ajoute les deux fichiers Swift à la cible Xcode (sinon ils ne sont pas compilés)
gem list -i xcodeproj >/dev/null 2>&1 || gem install xcodeproj --no-document
ruby -rxcodeproj -e '
  proj = Xcodeproj::Project.open("ios/App/App.xcodeproj")
  target = proj.targets.find { |t| t.name == "App" }
  group = proj.main_group.find_subpath("App", true)
  %w[CoreMidiPlugin.swift MainViewController.swift].each do |f|
    next if group.files.any? { |r| r.path == f }
    target.add_file_references([group.new_file(f)])
  end
  proj.save
'

# 2. Le storyboard utilise notre contrôleur (celui qui enregistre le plugin MIDI)
SB="$APP/Base.lproj/Main.storyboard"
sed -i.bak 's/customClass="CAPBridgeViewController" customModule="Capacitor"/customClass="MainViewController" customModule="App"/' "$SB"
rm -f "$SB.bak"
grep -q 'customClass="MainViewController"' "$SB" || { echo "ERREUR: storyboard non modifié"; exit 1; }

# 3. Info.plist : réseau local (synchro avec le PC) + http local autorisé
PL="$APP/Info.plist"
PB=/usr/libexec/PlistBuddy
$PB -c "Add :NSLocalNetworkUsageDescription string Synchroniser la bibliothèque PianoFlow avec le PC." "$PL" 2>/dev/null || true
$PB -c "Add :NSAppTransportSecurity dict" "$PL" 2>/dev/null || true
$PB -c "Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true" "$PL" 2>/dev/null || true
echo "setup-ios OK"
