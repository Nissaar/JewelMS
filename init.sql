-- # Haujee Jewellery Database Schema (PostgreSQL)

-- User Management
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'User' CHECK (role IN ('Admin', 'User')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Granular Permissions Configuration
-- Admins can assign granular permissions per functionality to any user.
CREATE TABLE IF NOT EXISTS roles_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    functionality VARCHAR(50) NOT NULL, -- e.g., 'sales', 'stock_edit', 'user_management'
    can_view BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, functionality)
);

-- Audit Logging
-- Track every user action (login, sales, stock edits)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL, -- e.g., 'LOGIN', 'SALES_CREATE', 'STOCK_UPDATE'
    details JSONB, -- Details of the change/action
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stock Management
CREATE TABLE IF NOT EXISTS stock (
    id SERIAL PRIMARY KEY,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('Jewellery', 'Pen', 'Sewing Machine', 'Parts')),
    sub_category VARCHAR(100), -- necklace, rings, Brand, etc.
    stock_type VARCHAR(20) NOT NULL CHECK (stock_type IN ('on-display', 'in-store')),
    
    -- General / Non-Jewellery Fields
    brand VARCHAR(100),
    years_of_guarantee INTEGER DEFAULT 0,
    serial_number VARCHAR(100),

    -- Jewellery Specifics
    metal_type VARCHAR(50), -- Silver, Gold, etc.
    fineness VARCHAR(20), -- 18K, 24K, etc.
    weight_grams NUMERIC(10, 3),

    status VARCHAR(20) DEFAULT 'Disponible' NOT NULL,
    sold_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- KYC (Customers)
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    phone_number VARCHAR(20),
    id_number VARCHAR(100) UNIQUE NOT NULL, -- National ID, Passport, etc.
    risk_rating VARCHAR(20) DEFAULT 'Low' CHECK (risk_rating IN ('Low', 'Medium', 'High')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure id_number is indexed for cross-querying
CREATE INDEX IF NOT EXISTS idx_customers_id_number ON customers(id_number);

-- Sales Management
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    stock_id INTEGER REFERENCES stock(id) ON DELETE SET NULL,
    datetime TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('Cash', 'Juice', 'Card', 'Bank Transfer', 'Cheque')),
    cheque_number VARCHAR(50), -- Only for 'Cheque' payment mode
    qty INTEGER DEFAULT 1,
    item_details TEXT,
    weight NUMERIC(10, 3),
    fineness VARCHAR(20),
    unit_sales_price NUMERIC(15, 2),
    amount NUMERIC(15, 2),
    vat_15 NUMERIC(15, 2), -- Calculated field (15% of amount/taxable base)
    metal_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Receipts
CREATE TABLE IF NOT EXISTS receipts (
    id SERIAL PRIMARY KEY,
    receipt_serial_number SERIAL, -- Auto-incrementing serial number
    sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
    print_count INTEGER DEFAULT 0,
    file_url TEXT, -- Link to S3/R2 storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders (Manual entries)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number SERIAL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    item_description TEXT,
    estimated_weight NUMERIC(10, 3),
    final_weight NUMERIC(10, 3),
    final_price NUMERIC(15, 2),
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Finalized')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ODF (Trade-ins)
CREATE TABLE IF NOT EXISTS odf (
    id SERIAL PRIMARY KEY,
    odf_serial_number SERIAL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    item_reserved_repair TEXT,
    comments TEXT,
    weight NUMERIC(10, 3),
    metal_type VARCHAR(50), -- Silver, Gold
    fineness VARCHAR(20),
    amount NUMERIC(15, 2),
    image_url TEXT, -- Field for uploaded serial number/form photo
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- App Settings (Global texts)
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'receipt_heading', 'receipt_policy_wording'
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Initial Settings seeding
INSERT INTO settings (key, value) VALUES 
('receipt_heading', 'Haujee Jewellery - Official Pharmacy of Gold & Silver'),
('receipt_policy_wording', 'All sales are final. No returns on customized jewellery.'),
('stock_categories', '["Jewellery", "Pen", "Sewing Machine", "Parts"]'),
('stock_metal_types', '["Or", "Argent", "Platine"]'),
('stock_fineness_options', '["18K", "22K", "24K", "925", "950"]'),
('stock_pen_brands', '["Parker", "Cross", "Waterman", "Montblanc"]'),
('stock_sewing_machine_brands', '["Singer", "Bernina", "Brother", "Janome"]'),
('stock_sub_categories', '["Bague", "Collier", "Bracelet", "Boucles d''oreilles", "Pendentif"]'),
('guarantee_options', '["0", "1", "2", "3", "5", "10"]')
ON CONFLICT (key) DO NOTHING;

-- Initial Roles/Users seeding can be done here or via application logic.
-- Default Administrator (Seed)
-- INSERT INTO users (username, email, password_hash, role) VALUES ('admin', 'admin@haujee.com', '...', 'Admin');

INSERT INTO users (username, email, password_hash, role) VALUES ('admin', 'admin@haujee.com', '$2b$10$HC4mocVNzdwGPHxu8J/HyeoWDglmA9NlTAXjcrz2MtMO5N3Ycw3LS', 'Admin');