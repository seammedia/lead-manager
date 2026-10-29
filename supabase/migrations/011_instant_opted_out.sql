-- A reply asking to be removed (unsubscribe, stop, not interested) is an opt-out, not a warm lead
alter table lead_enrichments drop constraint if exists lead_enrichments_status_check;
alter table lead_enrichments add constraint lead_enrichments_status_check
  check (status in ('received', 'checking', 'drafted', 'sent', 'replied', 'opted_out', 'failed', 'skipped'));
