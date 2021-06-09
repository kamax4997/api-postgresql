
CREATE EXTENSION pg_stat_statements;
-- heroku pg:index-usage
-- heroku pg:outliers
-- heroku pg:diagnose

-- required for USER_MODE=team
-- DROP TABLE orgs CASCADE;
CREATE TABLE orgs(
    id TEXT NOT NULL PRIMARY KEY, -- public, short 10 char random text
    create_date TIMESTAMPTZ DEFAULT now(),
    created_by TEXT, -- user id
    update_date TIMESTAMPTZ DEFAULT now(),
    update_by TEXT,  -- user id
    name TEXT,
    email TEXT,
    homepage_url TEXT,
    logo JSONB,
    plan TEXT NOT NULL DEFAULT 'trial', 
    settings JSONB, -- optional public company settings
    settings_private JSONB, -- optional private company settings
    meta JSONB,
    --subscription fields. Duplicate in both users and company table, depends on USER_MODE which one is actually used
    trial_days NUMERIC DEFAULT 30, -- replace with how many days you offer a free trial
    subscription_start_date TIMESTAMPTZ,
    subscription_processor text DEFAULT 'braintree',
    subscription_ip text, -- required for VAT
    subscription_card_country_code text, -- required for VAT. Provided by payment processor. paymentMethod.customerLocation
    subscription json
);



-- DROP TABLE users CASCADE;
CREATE TABLE users(
    id TEXT NOT NULL PRIMARY KEY, -- public, short 10 char random text
    org_id TEXT, -- optional
    invite_key TEXT,
    permissions TEXT[] DEFAULT ARRAY[]::TEXT[], -- eg admin,reports,manage-orders
    create_date TIMESTAMPTZ DEFAULT now(),
    email TEXT NOT NULL UNIQUE,
    verified boolean DEFAULT false, 
    salt TEXT,
    password TEXT,
    last_signin_date TIMESTAMPTZ,
    one_time_signin_token TEXT, -- not used. If you need to enable user registration in static landing page, use it to login to dashboard afterwards.
    reset_password_token TEXT,
    reset_password_valid_by TIMESTAMPTZ,

    name VARCHAR(50),
    first_name VARCHAR(50),
    phone VARCHAR(50),
    photo JSONB,
    settings JSONB DEFAULT '{}', -- eg "unit_system":"metric"
    marketing BOOLEAN DEFAULT true, --allowed?
    marketing_unsubscribe_token TEXT, -- random id generated on user creation
    referral TEXT, -- optional; save promo_code here
    source TEXT, -- optional; source of signup, eg invite or specific site
    meta JSONB,
    --subscription fields. Duplicate in both users and company table, depends on USER_MODE which one is actually used
    trial_days NUMERIC DEFAULT 14, -- replace with how many days you offer a free trial
    subscription_start_date TIMESTAMPTZ,
    subscription_processor text DEFAULT 'braintree',
    subscription_ip text, -- required for VAT
    subscription_card_country_code text, -- required for VAT. Provided by payment processor. paymentMethod.customerLocation
    subscription json
);

--ALTER TABLE users ADD COLUMN trial_days NUMERIC DEFAULT 14;



-- DROP TABLE products CASCADE;
CREATE TABLE products(
    id TEXT NOT NULL PRIMARY KEY,
    create_date TIMESTAMPTZ DEFAULT now(),
    update_date TIMESTAMPTZ DEFAULT now(),
    org_id TEXT NOT NULL, -- change to user_id if USER_MODE=single
    title TEXT,
    description TEXT,
    type TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    price NUMERIC,
    images JSONB,
    meta JSONB
);

-- ALTER TABLE products ADD COLUMN images JSONB;
