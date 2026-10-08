-- pg_net was just installed by the queue migration and has no dispatched requests.
-- Install its extension marker in the non-public extensions schema.
drop extension pg_net;
create extension pg_net with schema extensions;
