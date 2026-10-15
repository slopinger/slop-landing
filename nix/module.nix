{ self }: { config, lib, pkgs, ... }: let
  cfg = config.freifick.slopd;
  inherit (lib) mkOption types;

  dbArgs = "--db ${cfg.dataDir}/slopd.sqlite3";

  # Moderation CLI: slopctl list [-n N] | hide ID... | unhide ID... | delete ID... | set-visits N
  slopctl = pkgs.writeShellScriptBin "slopctl" ''
    exec /run/wrappers/bin/sudo -u ${cfg.user} ${lib.getExe cfg.package} ${dbArgs} "$@"
  '';
in {
  options.freifick.slopd = {
    enable = lib.mkEnableOption "slopd, the freifick.net guestbook + visitor counter API";
    package = mkOption {
      type = types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.slopd;
      description = "slopd executable package.";
    };
    host = mkOption {
      type = types.str;
      default = "127.0.0.1";
      description = "Address to listen on. Keep it on loopback; Caddy proxies /api/* to it.";
    };
    port = mkOption {
      type = types.port;
      default = 8787;
      description = "Port to listen on.";
    };
    user = mkOption {
      type = types.str;
      default = "slopd";
      description = "User (and group) slopd runs as.";
    };
    dataDir = mkOption {
      type = types.str;
      default = "/var/lib/slopd";
      readOnly = true;
      description = "State directory holding the SQLite database.";
    };
  };

  config = lib.mkIf cfg.enable {
    users.users.${cfg.user} = {
      isSystemUser = true;
      group = cfg.user;
      home = cfg.dataDir;
      description = "slopd guestbook/counter service";
    };
    users.groups.${cfg.user} = { };

    environment.systemPackages = [ slopctl ];

    systemd.services.slopd = {
      description = "slopd: guestbook + visitor counter API for freifick.net";
      after = [ "network.target" ];
      wantedBy = [ "multi-user.target" ];

      serviceConfig = {
        Type = "simple";
        User = cfg.user;
        Group = cfg.user;
        ExecStart = "${lib.getExe cfg.package} ${dbArgs} serve --host ${cfg.host} --port ${toString cfg.port}";
        StateDirectory = "slopd";
        StateDirectoryMode = "0700";
        UMask = "0077";
        Restart = "on-failure";
        RestartSec = 2;

        # Sandboxing: slopd only needs its state dir and a loopback socket.
        NoNewPrivileges = true;
        CapabilityBoundingSet = "";
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        PrivateDevices = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectKernelLogs = true;
        ProtectControlGroups = true;
        ProtectClock = true;
        ProtectHostname = true;
        ProtectProc = "invisible";
        RestrictAddressFamilies = [ "AF_INET" "AF_INET6" "AF_UNIX" ];
        RestrictNamespaces = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        LockPersonality = true;
        MemoryDenyWriteExecute = true;
        SystemCallArchitectures = "native";
        SystemCallFilter = [ "@system-service" "~@privileged @resources" ];
        IPAddressDeny = "any";
        IPAddressAllow = "localhost";
        MemoryMax = "256M";
        TasksMax = 128;
      };
    };
  };
}
