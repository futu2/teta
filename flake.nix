{
  description = "Development shell for teta";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { nixpkgs, ... }:
    let
      lib = nixpkgs.lib;
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          linuxLibs = lib.optionals pkgs.stdenv.isLinux [ pkgs.stdenv.cc.cc.lib ];
        in
        {
          default = pkgs.mkShell {
            packages = [ pkgs.bun ] ++ linuxLibs;

            LD_LIBRARY_PATH = lib.optionalString pkgs.stdenv.isLinux (
              lib.makeLibraryPath linuxLibs
            );
          };
        }
      );
    };
}
