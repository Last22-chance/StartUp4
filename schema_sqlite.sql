-- SQLite Schema for Salam tables with proper primary key and foreign key relationships
-- This version uses SQLite-specific syntax

-- Enable foreign key constraints (important for SQLite)
PRAGMA foreign_keys = ON;

-- First, create the Salam table with a proper primary key
CREATE TABLE Salam (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Then, create the Salam2 table with a foreign key reference
CREATE TABLE Salam2 (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Salam_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- Add foreign key constraint with explicit reference
    FOREIGN KEY (Salam_id) 
        REFERENCES Salam(Id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- Optional: Create indexes for better performance
CREATE INDEX IDX_Salam2_Salam_id ON Salam2(Salam_id);

-- Insert some sample data to verify the relationship works
INSERT INTO Salam (name, description) VALUES 
    ('First Salam', 'This is the first Salam entry'),
    ('Second Salam', 'This is the second Salam entry');

INSERT INTO Salam2 (Salam_id, title, content) VALUES 
    (1, 'Related to First Salam', 'This record is related to the first Salam'),
    (1, 'Another for First Salam', 'Another record for the first Salam'),
    (2, 'Related to Second Salam', 'This record is related to the second Salam');