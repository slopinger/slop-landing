{
  description = "slop website and SQLite guestbook API";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  outputs = { self, nixpkgs }: let
    systems = [ "x86_64-linux" "aarch64-linux" ];
    eachSystem = nixpkgs.lib.genAttrs systems;
  in {
    packages = eachSystem (system: let pkgs = nixpkgs.legacyPackages.${system}; in {
      default = self.packages.${system}.site;
      site = pkgs.stdenvNoCC.mkDerivation {
        pname = "slop-landing";
        version = "0.1.0";
        src = ./.;
        nativeBuildInputs = [ pkgs.wabt pkgs.nodejs ];
        buildPhase = "bash tools/build-bloons.sh";
        doCheck = true;
        checkPhase = ''
          node --check site/arcade/bloons/game.js
          node tools/test-bloons.mjs
        '';
        installPhase = "mkdir -p $out; cp -r site/. $out/";
        meta.license = pkgs.lib.licenses.mit;
      };
      slopd = pkgs.stdenvNoCC.mkDerivation {
        pname = "slopd";
        version = "0.1.0";
        src = ./backend;
        nativeBuildInputs = [ pkgs.makeWrapper ];
        nativeCheckInputs = [ pkgs.python3 ];
        dontBuild = true;
        doCheck = true;
        checkPhase = "python3 -m unittest discover -s tests -v";
        installPhase = ''
          install -Dm644 slopd.py $out/lib/slopd/slopd.py
          makeWrapper ${pkgs.python3}/bin/python3 $out/bin/slopd \
            --add-flags "-I $out/lib/slopd/slopd.py"
        '';
        meta = { license = pkgs.lib.licenses.mit; mainProgram = "slopd"; platforms = systems; };
      };
    });
    checks = eachSystem (system: {
      inherit (self.packages.${system}) site slopd;
    });
    devShells = eachSystem (system: {
      default = nixpkgs.legacyPackages.${system}.mkShell {
        packages = with nixpkgs.legacyPackages.${system}; [ python3 wabt nodejs ];
      };
    });
    hydraJobs = nixpkgs.lib.foldlAttrs (acc: system: jobs:
      nixpkgs.lib.recursiveUpdate acc (nixpkgs.lib.mapAttrs (_: p: { ${system} = p; }) jobs)
    ) {} self.checks;
    nixosModules.default = import ./nix/module.nix { inherit self; };
  };
}
