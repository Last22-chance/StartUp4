-- Schema for Salam tables with proper primary key and foreign key relationships
-- This SQL script creates the tables in the correct order to avoid foreign key errors

-- First, create the Salam table with a proper primary key
CREATE TABLE Salam (
    Id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (Id)
);

-- Then, create the Salam2 table with a foreign key reference
CREATE TABLE Salam2 (
    Id INT NOT NULL AUTO_INCREMENT,
    Salam_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (Id),
    -- Add foreign key constraint with explicit reference
    CONSTRAINT FK_Salam2_Salam_id 
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