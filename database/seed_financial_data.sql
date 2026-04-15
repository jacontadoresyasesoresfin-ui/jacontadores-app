-- Script SQL para generar datos de demostración financieros
-- Este script crea facturas, pagos y gastos para los últimos 6 meses

-- NOTA: Ejecutar este script en Supabase SQL Editor
-- Reemplazar 'eb0130b9-5093-442c-ac40-f5f44a099108' con tu tenant_id real

DO $$
DECLARE
    v_tenant_id UUID := 'eb0130b9-5093-442c-ac40-f5f44a099108';
    v_invoice_id UUID;
    v_customer_id UUID;
    v_product_id UUID;
    v_invoice_number VARCHAR;
    v_payment_number VARCHAR;
    v_expense_number VARCHAR;
    v_date DATE;
    v_total DECIMAL;
    v_subtotal DECIMAL;
    v_tax DECIMAL;
    i INTEGER;
    j INTEGER;
BEGIN
    -- Generar 150 facturas en los últimos 6 meses
    FOR i IN 1..150 LOOP
        -- Fecha aleatoria en los últimos 180 días
        v_date := CURRENT_DATE - (random() * 180)::INTEGER;
        
        -- Seleccionar cliente aleatorio
        SELECT id INTO v_customer_id FROM public.customers 
        WHERE tenant_id = v_tenant_id 
        ORDER BY random() LIMIT 1;
        
        v_invoice_number := 'FV-2024-' || LPAD(i::TEXT, 5, '0');
        
        -- Calcular totales
        v_subtotal := (random() * 5000000 + 500000)::DECIMAL(15,2);
        v_tax := (v_subtotal * 0.19)::DECIMAL(15,2);
        v_total := v_subtotal + v_tax;
        
        -- Insertar factura
        INSERT INTO public.invoices (
            tenant_id, invoice_number, customer_id, invoice_date, due_date,
            subtotal, tax_amount, total_amount, paid_amount, status, payment_method
        ) VALUES (
            v_tenant_id, v_invoice_number, v_customer_id, v_date, v_date + 30,
            v_subtotal, v_tax, v_total,
            CASE 
                WHEN random() < 0.7 THEN v_total  -- 70% pagadas
                WHEN random() < 0.9 THEN v_total * 0.5  -- 20% parcialmente pagadas
                ELSE 0  -- 10% sin pagar
            END,
            CASE 
                WHEN random() < 0.7 THEN 'paid'
                WHEN random() < 0.9 THEN 'pending'
                ELSE 'overdue'
            END,
            CASE (random() * 4)::INTEGER
                WHEN 0 THEN 'transfer'
                WHEN 1 THEN 'credit_card'
                WHEN 2 THEN 'cash'
                ELSE 'check'
            END
        ) RETURNING id INTO v_invoice_id;
        
        -- Insertar 2-5 items por factura
        FOR j IN 1..(2 + (random() * 3)::INTEGER) LOOP
            SELECT id, unit_price INTO v_product_id, v_subtotal 
            FROM public.products 
            WHERE tenant_id = v_tenant_id 
            ORDER BY random() LIMIT 1;
            
            INSERT INTO public.invoice_items (
                invoice_id, product_id, product_name, quantity, unit_price, tax_rate, line_total
            )
            SELECT 
                v_invoice_id,
                id,
                name,
                (random() * 50 + 1)::DECIMAL(10,2),
                unit_price,
                tax_rate,
                ((random() * 50 + 1) * unit_price)::DECIMAL(15,2)
            FROM public.products 
            WHERE id = v_product_id;
        END LOOP;
    END LOOP;
    
    -- Generar 200 pagos
    FOR i IN 1..200 LOOP
        v_date := CURRENT_DATE - (random() * 180)::INTEGER;
        v_payment_number := 'PAG-2024-' || LPAD(i::TEXT, 5, '0');
        
        SELECT id INTO v_invoice_id FROM public.invoices 
        WHERE tenant_id = v_tenant_id 
        ORDER BY random() LIMIT 1;
        
        INSERT INTO public.payments (
            tenant_id, invoice_id, payment_number, payment_date, amount, payment_method
        ) VALUES (
            v_tenant_id, v_invoice_id, v_payment_number, v_date,
            (random() * 3000000 + 100000)::DECIMAL(15,2),
            CASE (random() * 4)::INTEGER
                WHEN 0 THEN 'transfer'
                WHEN 1 THEN 'credit_card'
                WHEN 2 THEN 'cash'
                ELSE 'debit_card'
            END
        );
    END LOOP;
    
    -- Generar 100 gastos
    FOR i IN 1..100 LOOP
        v_date := CURRENT_DATE - (random() * 180)::INTEGER;
        v_expense_number := 'GAS-2024-' || LPAD(i::TEXT, 5, '0');
        
        INSERT INTO public.expenses (
            tenant_id, expense_number, expense_date, category, amount, tax_amount,
            vendor_name, payment_method, status
        ) VALUES (
            v_tenant_id, v_expense_number, v_date,
            CASE (random() * 8)::INTEGER
                WHEN 0 THEN 'Arriendo'
                WHEN 1 THEN 'Servicios Públicos'
                WHEN 2 THEN 'Nómina'
                WHEN 3 THEN 'Marketing'
                WHEN 4 THEN 'Transporte'
                WHEN 5 THEN 'Suministros'
                WHEN 6 THEN 'Mantenimiento'
                ELSE 'Otros'
            END,
            (random() * 2000000 + 100000)::DECIMAL(15,2),
            (random() * 380000)::DECIMAL(15,2),
            'Proveedor ' || i,
            CASE (random() * 3)::INTEGER
                WHEN 0 THEN 'transfer'
                WHEN 1 THEN 'check'
                ELSE 'cash'
            END,
            CASE 
                WHEN random() < 0.8 THEN 'paid'
                ELSE 'pending'
            END
        );
    END LOOP;
    
    RAISE NOTICE 'Datos de demostración generados exitosamente';
END $$;
