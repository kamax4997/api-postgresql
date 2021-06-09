-- might avoid another query if passing parameters, but too many
CREATE OR REPLACE FUNCTION subscription_status(p_user_id TEXT) RETURNS varchar AS $$
    DECLARE v_user users%ROWTYPE;
    DECLARE v_org orgs%ROWTYPE;
BEGIN
    SELECT * INTO v_user FROM users WHERE id=p_user_id;

    IF (v_user.org_id IS NOT NULL) THEN
        -- load subscription info from org
        SELECT * INTO v_org FROM orgs WHERE id=v_user.org_id;
        v_user.subscription_start_date := v_org.subscription_start_date;
        v_user.create_date := v_org.create_date;
        v_user.trial_days := v_org.trial_days;
    END IF;

    IF v_user.subscription_start_date IS NOT NULL THEN
      RETURN 'subscribed';
    END IF;

    IF (v_user.create_date > (now() - (v_user.trial_days * interval '1 day' ))) THEN
      RETURN 'trial';
    END IF;

    --TODO consider org_id too. org might cover subscription, if approved
    RETURN 'trial_expired';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

SELECT email, subscription_start_date, create_date, subscription_status(id) AS status
FROM users
ORDER BY status
;



CREATE OR REPLACE FUNCTION my_searchable(
    p_string varchar
    ) RETURNS varchar AS $$
BEGIN
    RETURN COALESCE(p_string, '') || ' ';
    -- use a separator so search won't match parts from 2 different columns?. No need for LOWER(), use ILIKE
END
$$ LANGUAGE plpgsql IMMUTABLE;







--------------------------------------------

CREATE OR REPLACE FUNCTION product_collections(p_id bigint)
RETURNS BIGINT[] AS $$
DECLARE v_j BIGINT[];
BEGIN

    SELECT ARRAY(SELECT collection_id FROM collects WHERE product_id=p_id) INTO v_j;

    RETURN v_j;
END;
$$ LANGUAGE plpgsql;

SELECT product_collections(822246441007);



CREATE OR REPLACE FUNCTION product_collections(p_shop_id integer, p_id bigint)
RETURNS BIGINT[] AS $$
DECLARE v_j BIGINT[];
BEGIN

    SELECT ARRAY(SELECT collection_id FROM collects WHERE shop_id=p_shop_id AND product_id=p_id) INTO v_j;

    RETURN v_j;
END;
$$ LANGUAGE plpgsql;

SELECT product_collections(9, );


/*

EXPLAIN ANALYZE SELECT ARRAY(SELECT collection_id FROM collects WHERE product_id=2739659702336);
EXPLAIN ANALYZE SELECT product_collections(2739659702336);
EXPLAIN ANALYZE SELECT product_collections(9, 1236641906735); -- this is slower


CREATE OR REPLACE FUNCTION f_applied_sale_id(p_id bigint)
RETURNS INT AS $$
DECLARE v_j INT;
BEGIN

    BEGIN
        SELECT applied_sale_id FROM products_update_queue WHERE id=p_id AND status='done' ORDER BY queue_id DESC LIMIT 1 INTO v_j;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            v_j := NULL;
    END;


    RETURN v_j;
END;
$$ LANGUAGE plpgsql;

SELECT f_applied_sale_id(2740077625408);
*/

DROP FUNCTION f_applied_sale_details(integer,bigint);
CREATE OR REPLACE FUNCTION f_applied_sale_details(p_shop_id int, p_id bigint)
RETURNS JSONB AS $$
DECLARE v_sale_id INT;
DECLARE v_details JSONB;
BEGIN

    BEGIN
        SELECT applied_sale_id FROM products_update_queue WHERE shop_id=p_shop_id AND id=p_id AND status='done' ORDER BY queue_id DESC LIMIT 1 INTO v_sale_id;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            v_sale_id := NULL;
    END;

    IF (v_sale_id IS NOT NULL) THEN
        BEGIN
        SELECT details FROM sales WHERE shop_id=p_shop_id AND id=v_sale_id INTO v_details;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                v_details := NULL;
        END;

    END IF;

    RETURN v_details;
END;
$$ LANGUAGE plpgsql;


SELECT f_applied_sale_details(2, 2740077625408);
