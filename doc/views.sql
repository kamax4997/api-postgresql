
DROP VIEW users_session_v;
CREATE VIEW users_session_v AS
SELECT u.id, u.email, u.settings, u.name, u.first_name, u.permissions, subscription_status(u.id) AS subscription_status,
o.id AS org_id, o.name AS org_name, o.settings AS org_settings
FROM users u LEFT JOIN orgs o ON u.org_id=o.id
;
