-- Replies from people who can't buy marketing (no business, after paid ad viewing, spam) are kept off the pipeline (2 Nov 2026)
alter table lead_enrichments drop constraint if exists lead_enrichments_status_check;
alter table lead_enrichments add constraint lead_enrichments_status_check
  check (status in ('received', 'checking', 'drafted', 'sent', 'replied', 'opted_out', 'not_a_lead', 'failed', 'skipped'));
