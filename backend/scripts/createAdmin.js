const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Create admin user function
const createAdminUser = async (username, email, password, role = 'admin') => {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });

    if (existingUser) {
      console.log('User already exists with this username or email');
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin user
    const adminUser = new User({
      name: username,
      username,
      email,
      password: hashedPassword,
      role,
      isVerified: true,
      isActive: true,
      tokens: 1000 // Give admin some initial tokens
    });

    await adminUser.save();
    console.log(`✅ ${role.toUpperCase()} user created successfully:`);
    console.log(`Username: ${username}`);
    console.log(`Email: ${email}`);
    console.log(`Role: ${role}`);
    console.log(`Initial tokens: 1000`);

  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

// Main execution
const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node createAdmin.js <username> <email> <password> [role]');
    console.log('Example: node createAdmin.js admin admin@example.com password123 super_admin');
    process.exit(1);
  }

  const [username, email, password, role = 'admin'] = args;

  // Validate role
  if (!['admin', 'super_admin'].includes(role)) {
    console.log('Invalid role. Use "admin" or "super_admin"');
    process.exit(1);
  }

  await createAdminUser(username, email, password, role);
  
  // Close connection
  mongoose.connection.close();
  console.log('Database connection closed');
};

// Run the script
main().catch(console.error); 