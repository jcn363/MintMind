use std::env;
use ripgrep_rust_parser::parse_ripgrep_output;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 2 {
        eprintln!("Usage: {} <root_uri>", args[0]);
        std::process::exit(1);
    }

    let root_uri = &args[1];
    if let Err(e) = parse_ripgrep_output(root_uri) {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    }
}