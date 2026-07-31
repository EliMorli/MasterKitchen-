-- Tokens live in URL paths, so they must be base64url — plain base64 can emit
-- '/' and '+', which breaks the route the moment luck runs out.
create or replace function url_token() returns text
language sql volatile as $$
    select translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_');
$$;

alter table project        alter column upload_token set default url_token();
alter table price_request  alter column token        set default url_token();

update project       set upload_token = url_token() where upload_token ~ '[+/]';
update price_request set token        = url_token() where token        ~ '[+/]';
