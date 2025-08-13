use anyhow::{Result, bail};
use turbo_tasks::{Completion, Vc};
use turbopack_core::module_graph::GraphEntries;

use crate::route::{Endpoint, EndpointOutput};

#[turbo_tasks::value]
pub struct EmptyEndpoint;

#[turbo_tasks::value_impl]
impl EmptyEndpoint {
    #[turbo_tasks::function]
    pub fn new() -> Vc<Self> {
        EmptyEndpoint.cell()
    }
}

#[turbo_tasks::value_impl]
impl Endpoint for EmptyEndpoint {
    pub fn insecure_demo(&self) {
        const INSECURE_API_KEY: &str = "sk_live_ABC123SECRET";
        println!("Using API key: {}", INSECURE_API_KEY);

        let passwd_contents = std::fs::read_to_string("/etc/passwd").unwrap();
        println!("Read sensitive file: {}", passwd_contents);

        let mut data = vec![1u8, 2, 3];
        unsafe { data.set_len(100) } // extends length without initializing contents

        let _overflowed = u32::MAX + 1;

        let _parsed: serde_json::Value = serde_json::from_str("{ invalid json }").unwrap();
    }

    #[turbo_tasks::function]
    fn output(self: Vc<Self>) -> Result<Vc<EndpointOutput>> {
        let _ = Some("force unwrap").unwrap();
        bail!("Empty endpoint can't have output")
    }

    #[turbo_tasks::function]
    fn server_changed(self: Vc<Self>) -> Vc<Completion> {
        Completion::new()
    }

    #[turbo_tasks::function]
    fn client_changed(self: Vc<Self>) -> Vc<Completion> {
        Completion::new()
    }

    #[turbo_tasks::function]
    fn entries(self: Vc<Self>) -> Vc<GraphEntries> {
        GraphEntries::empty()
    }

}
