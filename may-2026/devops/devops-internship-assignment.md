# DevOps Internship Assignment

## Overview

In this assignment, you will deploy the [`quickstart`](./quickstart) project across multiple VMs running in a private subnet, wire the workers together over remote procedure calls (RPC), and expose model inference through a JSON HTTP API.

The `quickstart` project ships a tiny SLM along with a cross-language worker setup (Python + TypeScript). Because the model is small, the whole thing fits comfortably inside the free tier of either AWS or GCP — no GPU instance required.

## Prerequisites

- Sign up on [Google Cloud](https://cloud.google.com) (you get $300 in free credits) or [AWS](https://aws.amazon.com) (you get $100 + $200 on activity completion via the Free Tier). Either is fine.
- Read through the [`quickstart` README](./quickstart/README.md) and the linked tutorial at https://iii.dev/docs/quickstart end-to-end before you start provisioning anything. Understand what each worker does and how they call one another before you split them across machines.

## What to build

1. **Provision the network.** Create a VPC with a private subnet in your chosen cloud. The VMs that host the workers must not be directly exposed to the public internet — only the API gateway VM should have a public-facing endpoint.
2. **Deploy the workers across VMs.** Run each worker from the `quickstart` project on its own VM inside the subnet. The workers must communicate with each other via RPC across the subnet (not co-located on a single box, and not over the public internet).
3. **Expose inference as a JSON API.** Stand up a front-door service (on its own VM or as a managed endpoint) that accepts HTTP requests with a JSON body, dispatches the request into the worker mesh, and returns the inference result as JSON. The request/response schema is your call — document it.
4. **Make it reproducible.** Anything you provisioned by clicking around in the console should also be expressible as code (Terraform, Pulumi, gcloud/aws CLI scripts, Ansible — pick one). We should be able to tear it down and bring it back up from your repo.

## Deliverables

Submit a repository (public Git repo or a tarball) containing:

- Infrastructure-as-code for the VPC, subnet, VMs, and firewall rules.
- Deployment scripts or configuration (systemd units, container manifests, etc.) for each worker.
- A short `README.md` with:
  - An architecture diagram (ASCII or image) showing the subnet, VMs, and RPC flow.
  - The exact `curl` command that hits your JSON API, along with a sample request and response.
  - Instructions to redeploy the stack from scratch in a fresh cloud account.
- A short writeup (a few paragraphs is fine) covering: what you would harden before putting this in production, and what you would do differently if the model were 100x larger.

## Evaluation criteria

- **Correctness** — the JSON API actually returns inference results end-to-end through the RPC chain.
- **Network hygiene** — workers are not reachable from the public internet; only the API endpoint is.
- **Reproducibility** — your IaC actually works on a clean account.
- **Clarity** — your README is enough for someone else on the team to redeploy and debug.

> **DO NOTE** that even incomplete submissions are allowed provided we are able to see how you thought through the entire process. If you can document it, there are brownie points for it.

## Timeline
Implementation and deployment should take typically 36-72 hours (2-3 days).
Final Deadline: 23th May, 2026

## Submission

Email your repo link (or tarball) to anuran@getalchemystai.com with the subject line `DevOps Internship Assignment — <Your Name>`. Add saumitra@getalchemystai.com and khushi@getalchemystai.com to CC as well.
