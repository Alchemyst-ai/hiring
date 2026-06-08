import { ResponseScript } from "./types.js";

// ─────────────────────────────────────────────────────────────
// Canned response scripts
//
// Each script defines a sequence of events the agent produces.
// The server picks a script based on keyword matching against
// the user's message, falling back to "default".
// ─────────────────────────────────────────────────────────────

export const RESPONSE_SCRIPTS: ResponseScript[] = [
  // ── 1. Simple greeting — no tools, short stream ───────────
  {
    id: "greeting",
    name: "Simple Greeting",
    triggers: ["hello", "hi", "hey", "greetings", "good morning", "good evening"],
    events: [
      {
        kind: "context",
        context_id: "ctx_session",
        data: {
          session_type: "conversational",
          capabilities: ["search", "analyze", "compute", "summarize"],
          model_version: "alchemyst-agent-v3.1",
        },
      },
      { kind: "token", text: "Hello! " },
      { kind: "token", text: "I'm the " },
      { kind: "token", text: "Alchemyst Agent. " },
      { kind: "token", text: "I can help you " },
      { kind: "token", text: "analyze data, " },
      { kind: "token", text: "look up metrics, " },
      { kind: "token", text: "retrieve context, " },
      { kind: "token", text: "and generate " },
      { kind: "token", text: "reports from " },
      { kind: "token", text: "your connected " },
      { kind: "token", text: "data sources. " },
      { kind: "token", text: "What would you " },
      { kind: "token", text: "like to explore " },
      { kind: "token", text: "today?" },
    ],
  },

  // ── 2. Report summary — context + one tool call ───────────
  {
    id: "report_summary",
    name: "Report Summary",
    triggers: ["report", "summary", "summarize", "quarterly", "q3", "q4", "earnings"],
    events: [
      {
        kind: "context",
        context_id: "ctx_report",
        data: {
          report: "Q3-2025-Financial",
          pages: 47,
          sections: ["revenue", "operations", "forecast", "risks"],
          last_updated: "2025-10-15T09:30:00Z",
          source: "internal-docs/finance/quarterly",
          access_level: "confidential",
        },
      },
      { kind: "token", text: "Based on " },
      { kind: "token", text: "the Q3 financial " },
      { kind: "token", text: "report, the overall " },
      { kind: "token", text: "performance shows " },
      { kind: "token", text: "strong growth " },
      { kind: "token", text: "across key metrics. " },
      { kind: "token", text: "Revenue grew " },
      {
        kind: "tool_call",
        tool_name: "lookup_metric",
        args: { metric: "revenue_yoy", quarter: "Q3-2025" },
        result: { value: "23.4%", period: "YoY", raw_amount: 4250000, currency: "USD" },
      },
      { kind: "token", text: "23.4% year-over-year, " },
      { kind: "token", text: "reaching $4.25M " },
      { kind: "token", text: "for the quarter. " },
      { kind: "token", text: "This growth was " },
      { kind: "token", text: "primarily driven by " },
      { kind: "token", text: "enterprise client " },
      { kind: "token", text: "expansion, with the " },
      { kind: "token", text: "top 10 accounts " },
      { kind: "token", text: "contributing 68% " },
      { kind: "token", text: "of new ARR. " },
      {
        kind: "context",
        context_id: "ctx_report",
        data: {
          report: "Q3-2025-Financial",
          pages: 47,
          sections: ["revenue", "operations", "forecast", "risks"],
          last_updated: "2025-10-15T09:30:00Z",
          source: "internal-docs/finance/quarterly",
          access_level: "confidential",
          current_focus: "operations",
          extracted_metrics: {
            revenue_yoy: "23.4%",
            operating_margin: "34%",
            prev_operating_margin: "28%",
          },
        },
      },
      { kind: "token", text: "Operating margins " },
      { kind: "token", text: "improved to 34%, " },
      { kind: "token", text: "up from 28% in Q2, " },
      { kind: "token", text: "largely due to " },
      { kind: "token", text: "infrastructure cost " },
      { kind: "token", text: "optimization and " },
      { kind: "token", text: "the migration to " },
      { kind: "token", text: "spot instances for " },
      { kind: "token", text: "non-critical workloads. " },
      { kind: "token", text: "The forecast section " },
      { kind: "token", text: "indicates continued " },
      { kind: "token", text: "momentum, with Q4 " },
      { kind: "token", text: "projections suggesting " },
      { kind: "token", text: "a potential 15-18% " },
      { kind: "token", text: "sequential increase." },
    ],
  },

  // ── 3. Multi-tool analysis — two tool calls ───────────────
  {
    id: "multi_tool",
    name: "Multi-Tool Analysis",
    triggers: ["analyze", "compare", "correlation", "analysis", "relationship"],
    events: [
      {
        kind: "context",
        context_id: "ctx_analysis",
        data: {
          analysis_type: "correlation",
          datasets: ["user_growth", "revenue", "churn"],
          timeframe: "2024-01 to 2025-09",
          requested_by: "product-team",
        },
      },
      { kind: "token", text: "Let me analyze " },
      { kind: "token", text: "the relationship " },
      { kind: "token", text: "between your " },
      { kind: "token", text: "key metrics. " },
      {
        kind: "tool_call",
        tool_name: "fetch_dataset",
        args: { dataset: "user_growth", timeframe: "2024-01:2025-09", granularity: "monthly" },
        result: {
          total_records: 2847,
          growth_rate: 0.12,
          trend: "accelerating",
          last_month_delta: 347,
        },
      },
      { kind: "token", text: "User growth data " },
      { kind: "token", text: "shows 2,847 new " },
      { kind: "token", text: "accounts over the " },
      { kind: "token", text: "period with a 12% " },
      { kind: "token", text: "compound monthly " },
      { kind: "token", text: "growth rate. The " },
      { kind: "token", text: "trend is accelerating, " },
      { kind: "token", text: "particularly in the " },
      { kind: "token", text: "last quarter. Now " },
      { kind: "token", text: "let me check how " },
      { kind: "token", text: "this correlates " },
      { kind: "token", text: "with revenue. " },
      {
        kind: "tool_call",
        tool_name: "compute_correlation",
        args: { metrics: ["user_growth", "revenue"], method: "pearson" },
        result: {
          correlation: 0.87,
          p_value: 0.001,
          lag_months: 2,
          confidence: "high",
          sample_size: 21,
        },
      },
      { kind: "token", text: "The Pearson " },
      { kind: "token", text: "correlation between " },
      { kind: "token", text: "user growth and " },
      { kind: "token", text: "revenue is 0.87 " },
      { kind: "token", text: "with high confidence " },
      { kind: "token", text: "(p < 0.001), but " },
      { kind: "token", text: "with a notable " },
      { kind: "token", text: "2-month lag. This " },
      { kind: "token", text: "suggests that user " },
      { kind: "token", text: "acquisition translates " },
      { kind: "token", text: "to revenue with " },
      { kind: "token", text: "approximately a " },
      { kind: "token", text: "60-day delay, " },
      { kind: "token", text: "likely reflecting " },
      { kind: "token", text: "your trial-to-paid " },
      { kind: "token", text: "conversion cycle." },
    ],
  },

  // ── 4. Immediate tool call — tool before any tokens ───────
  {
    id: "lookup",
    name: "Knowledge Base Lookup",
    triggers: ["look up", "lookup", "find", "search", "what is", "define"],
    events: [
      {
        kind: "tool_call",
        tool_name: "search_knowledge_base",
        args: { query: "deployment SLA requirements", top_k: 3 },
        result: {
          found: true,
          document: "SLA-Framework-v3",
          section: "4.2",
          relevance_score: 0.94,
          content_preview: "Production deployments require 99.95% uptime...",
        },
      },
      {
        kind: "context",
        context_id: "ctx_search",
        data: {
          source_document: "SLA-Framework-v3",
          section: "4.2",
          retrieval_method: "vector_search",
          confidence: 0.94,
        },
      },
      { kind: "token", text: "Based on the " },
      { kind: "token", text: "knowledge base, the " },
      { kind: "token", text: "current deployment SLA " },
      { kind: "token", text: "requirements are defined " },
      { kind: "token", text: "in the SLA Framework " },
      { kind: "token", text: "v3, section 4.2. " },
      { kind: "token", text: "Production deployments " },
      { kind: "token", text: "require 99.95% uptime " },
      { kind: "token", text: "with a maximum planned " },
      { kind: "token", text: "downtime of 4.38 hours " },
      { kind: "token", text: "per year. Critical path " },
      { kind: "token", text: "services have a stricter " },
      { kind: "token", text: "requirement of 99.99% " },
      { kind: "token", text: "availability. Incident " },
      { kind: "token", text: "response times are " },
      { kind: "token", text: "tiered: P0 incidents " },
      { kind: "token", text: "require acknowledgment " },
      { kind: "token", text: "within 5 minutes, P1 " },
      { kind: "token", text: "within 15 minutes, " },
      { kind: "token", text: "and P2 within one hour." },
    ],
  },

  // ── 5. Large context — oversized payload ──────────────────
  {
    id: "large_context",
    name: "Large Context Load",
    triggers: ["schema", "database", "large", "context", "full"],
    events: [
      {
        kind: "context",
        context_id: "ctx_schema",
        data: generateLargeContext(),
      },
      { kind: "token", text: "I've loaded the " },
      { kind: "token", text: "full database schema " },
      { kind: "token", text: "into context. The " },
      { kind: "token", text: "schema contains 64 " },
      { kind: "token", text: "tables across 4 primary " },
      { kind: "token", text: "domains: user management, " },
      { kind: "token", text: "billing, analytics, " },
      { kind: "token", text: "and agent operations. " },
      {
        kind: "tool_call",
        tool_name: "analyze_schema",
        args: { focus: "relationships", depth: "full" },
        result: {
          total_tables: 64,
          total_columns: 412,
          foreign_keys: 67,
          most_connected: "events",
          orphan_tables: ["legacy_logs", "temp_migrations"],
        },
      },
      { kind: "token", text: "The most connected " },
      { kind: "token", text: "table is `events` " },
      { kind: "token", text: "with 12 foreign key " },
      { kind: "token", text: "relationships. I also " },
      { kind: "token", text: "found 2 orphan tables " },
      { kind: "token", text: "that may be candidates " },
      { kind: "token", text: "for cleanup: " },
      { kind: "token", text: "`legacy_logs` and " },
      { kind: "token", text: "`temp_migrations`. " },
      {
        kind: "context",
        context_id: "ctx_schema",
        data: {
          ...generateLargeContext(),
          analysis_complete: true,
          flagged_issues: ["orphan_tables", "missing_indices", "wide_tables"],
        },
      },
      { kind: "token", text: "Would you like me " },
      { kind: "token", text: "to focus on a " },
      { kind: "token", text: "specific domain or " },
      { kind: "token", text: "analyze the overall " },
      { kind: "token", text: "architecture?" },
    ],
  },

  // ── 6. Long response — many tokens + tool call ────────────
  {
    id: "long_response",
    name: "Long Detailed Response",
    triggers: ["long", "detailed", "document", "write", "explain in detail", "comprehensive"],
    events: [
      {
        kind: "context",
        context_id: "ctx_doc",
        data: {
          document_type: "technical_brief",
          topic: "context_engine_architecture",
          audience: "engineering_team",
        },
      },
      { kind: "token", text: "The context engine " },
      { kind: "token", text: "architecture is built " },
      { kind: "token", text: "around three core " },
      { kind: "token", text: "principles: verifiable " },
      { kind: "token", text: "retrieval, persistent " },
      { kind: "token", text: "memory, and sub-200ms " },
      { kind: "token", text: "latency at the p99. " },
      { kind: "token", text: "At its foundation, " },
      { kind: "token", text: "the engine maintains " },
      { kind: "token", text: "a directed acyclic " },
      { kind: "token", text: "graph of context " },
      { kind: "token", text: "nodes, where each " },
      { kind: "token", text: "node represents a " },
      { kind: "token", text: "discrete unit of " },
      { kind: "token", text: "business knowledge " },
      { kind: "token", text: "with provenance " },
      { kind: "token", text: "metadata attached. " },
      { kind: "token", text: "When an agent " },
      { kind: "token", text: "requests context, " },
      { kind: "token", text: "the engine performs " },
      { kind: "token", text: "a weighted traversal " },
      { kind: "token", text: "of this graph, " },
      { kind: "token", text: "scoring relevance " },
      { kind: "token", text: "against the current " },
      { kind: "token", text: "query and session " },
      { kind: "token", text: "history. " },
      {
        kind: "tool_call",
        tool_name: "fetch_architecture_diagram",
        args: { component: "context_engine", format: "summary" },
        result: {
          layers: ["ingestion", "indexing", "retrieval", "caching"],
          throughput: "12k_queries_per_second",
          p99_latency_ms: 187,
          storage_backend: "hybrid_vector_kv",
        },
      },
      { kind: "token", text: "The architecture " },
      { kind: "token", text: "consists of four " },
      { kind: "token", text: "layers. The ingestion " },
      { kind: "token", text: "layer handles document " },
      { kind: "token", text: "parsing, chunking, " },
      { kind: "token", text: "and entity extraction. " },
      { kind: "token", text: "The indexing layer " },
      { kind: "token", text: "maintains both vector " },
      { kind: "token", text: "embeddings and " },
      { kind: "token", text: "structured metadata " },
      { kind: "token", text: "indices. The retrieval " },
      { kind: "token", text: "layer performs hybrid " },
      { kind: "token", text: "search combining " },
      { kind: "token", text: "semantic similarity " },
      { kind: "token", text: "with keyword matching " },
      { kind: "token", text: "and graph traversal. " },
      { kind: "token", text: "Finally, the caching " },
      { kind: "token", text: "layer maintains a " },
      { kind: "token", text: "session-scoped LRU " },
      { kind: "token", text: "cache that reduces " },
      { kind: "token", text: "redundant retrievals " },
      { kind: "token", text: "by approximately 40%. " },
      { kind: "token", text: "Current throughput " },
      { kind: "token", text: "sits at 12,000 queries " },
      { kind: "token", text: "per second with a " },
      { kind: "token", text: "p99 latency of 187ms, " },
      { kind: "token", text: "well within the " },
      { kind: "token", text: "sub-200ms target. " },
      { kind: "token", text: "The storage backend " },
      { kind: "token", text: "uses a hybrid " },
      { kind: "token", text: "vector-KV store " },
      { kind: "token", text: "that collocates " },
      { kind: "token", text: "embeddings with " },
      { kind: "token", text: "their source metadata, " },
      { kind: "token", text: "avoiding the join " },
      { kind: "token", text: "penalty that plagues " },
      { kind: "token", text: "separate vector and " },
      { kind: "token", text: "relational stores." },
    ],
  },

  // ── 7. Default — moderate response with one tool call ─────
  {
    id: "default",
    name: "Default Response",
    triggers: [],
    events: [
      {
        kind: "context",
        context_id: "ctx_session",
        data: {
          session_type: "general",
          capabilities: ["search", "analyze", "compute", "summarize"],
          active_sources: ["knowledge_base", "metrics_dashboard", "recent_docs"],
        },
      },
      { kind: "token", text: "I've reviewed " },
      { kind: "token", text: "your request. " },
      {
        kind: "tool_call",
        tool_name: "classify_intent",
        args: { text: "user_query", confidence_threshold: 0.7 },
        result: {
          intent: "general_query",
          confidence: 0.82,
          suggested_tools: ["search_knowledge_base"],
          category: "information_retrieval",
        },
      },
      { kind: "token", text: "Based on my analysis, " },
      { kind: "token", text: "this falls into an " },
      { kind: "token", text: "information retrieval " },
      { kind: "token", text: "category. I can search " },
      { kind: "token", text: "our knowledge base, " },
      { kind: "token", text: "analyze data patterns, " },
      { kind: "token", text: "or compute metrics " },
      { kind: "token", text: "for you. The context " },
      { kind: "token", text: "engine currently has " },
      { kind: "token", text: "access to your " },
      { kind: "token", text: "organization's " },
      { kind: "token", text: "documentation, metrics " },
      { kind: "token", text: "dashboards, and recent " },
      { kind: "token", text: "communication logs. " },
      { kind: "token", text: "What specific aspect " },
      { kind: "token", text: "would you like me " },
      { kind: "token", text: "to dig into?" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Large context generator (~550KB JSON)
// ─────────────────────────────────────────────────────────────

function generateLargeContext(): Record<string, unknown> {
  const tables: Record<string, unknown>[] = [];
  const domains = ["user_management", "billing", "analytics", "agent_ops"];
  const columnTypes = [
    "uuid", "varchar(255)", "text", "integer", "bigint",
    "boolean", "timestamp with time zone", "jsonb", "float8", "inet",
    "cidr", "macaddr", "bytea", "numeric(12,4)", "interval",
  ];
  const constraintTypes = ["NOT NULL", "UNIQUE", "CHECK", "DEFAULT", "REFERENCES"];
  const indexTypes = ["btree", "hash", "gin", "gist", "brin"];

  for (let i = 0; i < 64; i++) {
    const domain = domains[i % domains.length];
    const tableName = `${domain}_table_${i}`;
    const columns: Record<string, unknown>[] = [];
    const numColumns = 10 + (i % 8); // 10-17 columns per table

    for (let c = 0; c < numColumns; c++) {
      const colNames = [
        "id", "name", "status", "created_at", "updated_at",
        "value", "ref_id", "metadata", "score", "flags",
        "email", "config", "payload", "version", "checksum",
        "priority", "tags",
      ];
      const colDescriptions = [
        "primary key used for unique row identification across all foreign references",
        "human-readable display name, indexed for full-text search with pg_trgm extension",
        "current lifecycle status tracked via state machine transitions in the application layer",
        "timestamp of initial record creation, auto-populated by database trigger on insert",
        "timestamp of most recent modification, auto-updated by before-update trigger",
        "computed aggregate value derived from downstream analytics pipeline runs",
        "foreign key reference to the parent entity, cascades on delete per domain policy",
        "schemaless JSON metadata blob for extensible attributes not covered by typed columns",
        "normalized numeric score between 0.0 and 1.0 used for ranking and threshold filtering",
        "bitwise integer flags encoding boolean feature toggles (see docs/flags.md for bitmap)",
        "verified email address with uniqueness constraint, validated by application-level regex",
        "JSON configuration object merged with domain defaults at read time by the config service",
        "binary or JSON payload stored as the primary content body of this record type",
        "monotonically increasing version counter for optimistic concurrency control",
        "SHA-256 checksum of the payload column used for deduplication and integrity verification",
        "integer priority level (0=critical, 1=high, 2=normal, 3=low) used by the job scheduler",
        "array of string tags for categorical filtering, indexed with GIN for containment queries",
      ];

      const indices: Record<string, unknown>[] = [];
      if (c < 3 || c % 4 === 0) {
        indices.push({
          name: `idx_${tableName}_${colNames[c % colNames.length]}`,
          type: indexTypes[c % indexTypes.length],
          unique: c === 0,
          partial: c > 5 ? `WHERE status != 'archived'` : null,
          size_mb: Math.round((10 + Math.random() * 200) * 100) / 100,
        });
      }

      const constraints: Record<string, unknown>[] = [];
      if (c === 0) constraints.push({ type: "PRIMARY KEY" });
      if (c < 3) constraints.push({ type: "NOT NULL" });
      if (c % 6 === 0 && c > 0) {
        constraints.push({
          type: "REFERENCES",
          target_table: `${domains[(i + 1) % domains.length]}_table_${(i + c) % 64}`,
          target_column: "col_0_id",
          on_delete: c % 2 === 0 ? "CASCADE" : "SET NULL",
        });
      }

      columns.push({
        name: `col_${c}_${colNames[c % colNames.length]}`,
        type: columnTypes[c % columnTypes.length],
        nullable: c > 2,
        default_value: c === 3 ? "now()" : c === 4 ? "now()" : c === 13 ? "1" : null,
        indices,
        constraints,
        statistics: {
          null_fraction: c > 2 ? Math.round(Math.random() * 0.3 * 1000) / 1000 : 0,
          avg_width_bytes: 8 + (c % 5) * 32,
          n_distinct: c === 2 ? 6 : c === 0 ? -1 : Math.floor(100 + Math.random() * 50000),
          most_common_vals: c === 2
            ? ["active", "inactive", "pending", "archived", "suspended", "deleted"]
            : null,
          correlation: Math.round((Math.random() * 2 - 1) * 1000) / 1000,
        },
        description: `${colDescriptions[c % colDescriptions.length]} This column was introduced in migration ${20230100 + i * 10 + c} and is actively used by ${1 + (c % 4)} downstream services. Average query frequency: ${Math.floor(100 + Math.random() * 5000)} reads/sec, ${Math.floor(1 + Math.random() * 200)} writes/sec.`,
      });
    }

    const relationships: Record<string, unknown>[] = [];
    if (i > 0 && i % 3 === 0) {
      relationships.push({
        type: "belongs_to",
        target: `${domains[(i - 1) % domains.length]}_table_${i - 1}`,
        foreign_key: "col_0_id",
        on_delete: "CASCADE",
        cardinality: "many-to-one",
        join_frequency_per_sec: Math.floor(50 + Math.random() * 500),
      });
    }
    if (i % 5 === 0 && i < 40) {
      relationships.push({
        type: "has_many",
        target: `${domains[(i + 3) % domains.length]}_table_${i + 3}`,
        through: null,
        cardinality: "one-to-many",
        avg_children: Math.floor(3 + Math.random() * 50),
      });
    }
    if (i % 7 === 0) {
      relationships.push({
        type: "many_to_many",
        target: `${domains[(i + 2) % domains.length]}_table_${(i + 2) % 64}`,
        through: `join_${tableName}_${(i + 2) % 64}`,
        cardinality: "many-to-many",
      });
    }

    // Sample data (3 rows) to make the context more realistic
    const sampleRows: Record<string, unknown>[] = [];
    for (let r = 0; r < 3; r++) {
      const row: Record<string, unknown> = {};
      for (let c = 0; c < Math.min(numColumns, 8); c++) {
        const colNames = ["id", "name", "status", "created_at", "updated_at", "value", "ref_id", "metadata"];
        const key = `col_${c}_${colNames[c]}`;
        if (c === 0) row[key] = `${tableName}_${r}_${Math.random().toString(36).slice(2, 10)}`;
        else if (c === 1) row[key] = `Sample ${domain} record ${r} with extended name for display`;
        else if (c === 2) row[key] = ["active", "inactive", "pending"][r];
        else if (c === 3 || c === 4) row[key] = new Date(2025, 0, 1 + r * 30).toISOString();
        else if (c === 5) row[key] = Math.round(Math.random() * 10000) / 100;
        else if (c === 6) row[key] = `ref_${(i + r) % 64}_${Math.random().toString(36).slice(2, 8)}`;
        else if (c === 7) row[key] = { source: domain, version: r + 1, tags: ["auto", "generated"] };
      }
      sampleRows.push(row);
    }

    tables.push({
      name: tableName,
      schema: "public",
      domain,
      columns,
      relationships,
      sample_data: sampleRows,
      row_count_estimate: 1000 + i * 5000,
      dead_tuple_count: Math.floor(Math.random() * 500),
      avg_row_size_bytes: 128 + (i % 20) * 64,
      total_size_mb: Math.round((10 + i * 50 + Math.random() * 500) * 100) / 100,
      index_size_mb: Math.round((5 + i * 10 + Math.random() * 100) * 100) / 100,
      toast_size_mb: i % 3 === 0 ? Math.round(Math.random() * 200 * 100) / 100 : 0,
      last_vacuum: "2025-09-15T03:00:00Z",
      last_analyze: "2025-09-15T03:15:00Z",
      autovacuum_enabled: true,
      has_rls: i % 4 === 0,
      rls_policies: i % 4 === 0 ? [`policy_${domain}_read`, `policy_${domain}_write`] : [],
      partitioned: i % 8 === 0,
      partition_key: i % 8 === 0 ? "created_at" : null,
      partition_strategy: i % 8 === 0 ? "RANGE" : null,
      triggers: i % 6 === 0
        ? [{ name: `trg_${tableName}_audit`, timing: "AFTER", events: ["INSERT", "UPDATE", "DELETE"], function: `fn_audit_${domain}` }]
        : [],
      description: `Table ${i} in the ${domain} domain. Manages ${["core entities and their lifecycle states", "financial transaction records and payment ledger entries", "user behavior event logs and clickstream analytics", "agent runtime configuration and execution state"][i % 4]} for the ${domain.replace(/_/g, " ")} subsystem. Created during the ${["initial migration (2023-01)", "v2 schema update (2023-06)", "Q2 refactor (2024-04)", "performance optimization sprint (2024-09)"][i % 4]} phase. Primary consumers: ${["auth-service, user-api, admin-dashboard", "billing-service, invoice-generator, tax-engine", "analytics-pipeline, reporting-api, data-warehouse-sync", "agent-runtime, orchestrator, context-engine"][i % 4]}. SLA: ${["p99 < 50ms read, < 100ms write", "p99 < 200ms (batch), < 50ms (single)", "p99 < 500ms (analytical), < 100ms (realtime)", "p99 < 30ms read, < 80ms write"][i % 4]}.`,
    });
  }

  return {
    schema_version: "4.7.2",
    database: "alchemyst_production",
    engine: "PostgreSQL 16.1",
    total_tables: tables.length,
    total_size_gb: 234.7,
    total_index_size_gb: 67.3,
    active_connections: 142,
    max_connections: 500,
    domains,
    extensions: ["pg_trgm", "uuid-ossp", "pgcrypto", "postgis", "pg_stat_statements", "hstore"],
    replication: { mode: "streaming", replicas: 2, lag_bytes: 1024 },
    backup: { last_full: "2025-09-14T02:00:00Z", last_incremental: "2025-09-15T02:00:00Z", retention_days: 30 },
    tables,
  };
}

/**
 * Select a response script based on message content.
 * Falls back to the default script.
 */
export function selectScript(userMessage: string): ResponseScript {
  const lower = userMessage.toLowerCase();

  for (const script of RESPONSE_SCRIPTS) {
    if (script.triggers.length === 0) continue; // skip default
    for (const trigger of script.triggers) {
      if (lower.includes(trigger)) {
        return script;
      }
    }
  }

  // Fall back to default
  const defaultScript = RESPONSE_SCRIPTS.find((s) => s.id === "default");
  if (!defaultScript) throw new Error("No default script found");
  return defaultScript;
}
