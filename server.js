const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const path = require('path');
const session = require('express-session');
const json2xls = require('json2xls'); 

dotenv.config();

const app = express();

app.get('/', (req, res) => {
    res.redirect('/login');
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || '12345', 
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));

// MongoDB Models
const userSchema = new mongoose.Schema({
    Mail: { type: String, required: true, unique: true },
    Password: { type: String },
    Username: { type: String },
    City: { type: String },
    Postal_Code: { type: String },
    Telephone_Code: { type: String }, 
    Mobile_Number: { type: String },
    Alternate_Email_Address: { type: String },
    ACL: { type: String, default: 'User' },
    ModifiedBy: { type: String },
    ModifiedDate: { type: Date },
    // Additional fields
    Surname: { type: String },
    Name: { type: String },
    User_Type: { type: String },
    Role: { type: String },
    Department: { type: String },
    Account_Status: { type: Boolean },
    Location: { type: String }, 
    Country: { type: String },
    Office_Location: { type: String },
    Company_Name: { type: String, default: "Crescenza Consulting Group" }, 
    Employee_ID: { type: String } 
}, { collection: 'DATA' }); 

const User = mongoose.model('User', userSchema);

const timesheetSchema = new mongoose.Schema({
    userMail: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: { type: Date, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    breakTime: { type: Number, default: 0 }, // Changed to hours
    workHours: { type: Number, default: 0 },
    project: { type: String, required: true },
    extraHoursReason: { type: String },
    financialYear: {
        type: String,
        required: true,
        default: currentFinancialYear()
    }
});

function currentFinancialYear() {
    const today = new Date();
    const currentYear = today.getFullYear();
    return (today.getMonth() + 1 <= 3) ? (currentYear - 1) + '-' + currentYear : currentYear + '-' + (currentYear + 1);
}

const Timesheet = mongoose.model('Timesheet', timesheetSchema);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'CCG' 
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'password.html'));
});

app.get('/home', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login'); 
    }
    res.sendFile(path.join(__dirname, 'public', 'home.html')); 
});

// ... rest of your server.js code (Registration, Login, etc.)
// Registration Route - Check if email is registered
app.get('/api/auth/check-registered', async (req, res) => {
    const { email } = req.query;
    try {
        let user = await User.findOne({ Mail: email });
        if (!user) {
            return res.status(400).json({ error: 'Please enter a valid organization email' });
        }
        if (user.Password) {
            return res.status(400).json({ registered: true }); 
        }
        res.status(200).json({ registered: false }); 
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// OTP Verification Route
app.post('/api/auth/verify-otp', async (req, res) => {
    const { email, otp, password } = req.body;
    try {
        if (otp !== '1234') { 
            return res.status(400).json({ success: false });
        }
        let user = await User.findOne({ Mail: email });
        if (!user) {
            return res.status(400).json({ success: false }); 
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user.Password = hashedPassword;
        await user.save();

        res.status(200).json({ success: true });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Optional: OTP Resend Route
app.get('/api/auth/resend-otp', async (req, res) => {
    const { email } = req.query;
    try {
        // Implement OTP resend logic (if needed)
        res.status(200).json({ success: true });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Registration Route - Register user after OTP verification
app.post('/api/auth/register', async (req, res) => {
    const { email, password, confirmPassword } = req.body;
    try {
        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }
        let user = await User.findOne({ Mail: email });
        if (user) {
            return res.status(400).json({ message: 'User already registered' });
        }
        const newUser = new User({
            Mail: email,
            Password: password
        });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error'); 
    }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ Mail: email });
        if (!user) {
            return res.status(400).send({ message: 'Invalid credentials' }); 
        }
        const isMatch = await bcrypt.compare(password, user.Password);
        if (!isMatch) {
            return res.status(400).send({ message: 'Invalid credentials' });
        }
        req.session.user = { 
            id: user.id, 
            email: user.Mail, 
            username: user.Username || 'Guest', 
            acl: user.ACL 
        };
        res.redirect('/home'); 
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Get user session
app.get('/api/auth/session', (req, res) => {
    if (req.session.user) {
        const { id, email, username, acl } = req.session.user;
        res.json({ id, email, username, acl });
    } else {
        res.status(401).json({ error: 'No user session found' });
    }
});

// Logout Route
app.get('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Server error'); 
        }
        res.redirect('/login'); 
    });
});

// User Details Route
app.get('/api/user/details', async (req, res) => {
    const { email } = req.query;
    try {
        const user = await User.findOne({ Mail: email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Exclude sensitive fields from the response
        const userResponse = { ...user._doc };
        delete userResponse.Password;
        delete userResponse.ACL;
        delete userResponse.__v; 
        delete userResponse._id; 

        res.status(200).json(userResponse); 
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Update User Details Route 
app.post('/api/user/update', async (req, res) => {
    const userEmail = req.session.user.email; 
    const updatedData = req.body;
    try {
        const user = await User.findOneAndUpdate(
            { Mail: userEmail }, 
            { 
                ...updatedData,
                ModifiedBy: req.session.user.username, 
                ModifiedDate: Date.now() 
            },
            { new: true }
        );
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ success: true }); 
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, error: err.message }); 
    }
});

// Timesheet Submission Route
app.post('/api/timesheet/submit', async (req, res) => {
    try {
        const { timesheetDate, startTime, endTime, breakTime, project, extraHoursReason } = req.body;
        const userId = req.session.user.id;

        // Date and Time Handling (Adjusting for India Time Zone)
        const userTimeZoneOffset = -330; // Offset for IST (GMT+5:30) in minutes 

        // Get the current date in IST
        const currentDayStart = new Date();
        currentDayStart.setHours(0, 0, 0, 0); 
        currentDayStart.setMinutes(currentDayStart.getMinutes() + userTimeZoneOffset);

        const currentDayEnd = new Date();
        currentDayEnd.setHours(23, 59, 59, 999); 
        currentDayEnd.setMinutes(currentDayEnd.getMinutes() + userTimeZoneOffset);

        // Log the current day start and end times in IST
        console.log("Current day start (IST):", currentDayStart);
        console.log("Current day end (IST):", currentDayEnd);
    

        // Parse the start and end times for the timesheet
        const start = new Date(`${timesheetDate}T${startTime}`);
        const end = new Date(`${timesheetDate}T${endTime}`);

        // Log the start and end times to verify correctness
        console.log("Start time:", start);
        console.log("End time:", end);

        // Ensure the timesheet entry is within the current day (India Time)
        if (start < currentDayStart || end > currentDayEnd) {
            return res.status(400).json({ success: false, error: 'Timesheet entries must be for the current day only (IST).' });
        }

        const workHours = (end - start - (breakTime * 3600000)) / 3600000; // breakTime is now in hours

        if (workHours > 8 && !extraHoursReason) {
            return res.status(400).json({ success: false, error: 'Please provide a reason for working extra hours.' }); 
        }

        const existingEntry = await Timesheet.findOne({ 
            userMail: userId, 
            date: { 
                $gte: currentDayStart, 
                $lt: currentDayEnd 
            } 
        });

        if (existingEntry) {
            // Ask the user if they want to modify the existing entry 
            // (You'll likely handle this confirmation in your client-side code)
            if (confirm("A timesheet entry for today already exists. Do you want to modify it?")) {
                existingEntry.startTime = start;
                existingEntry.endTime = end;
                existingEntry.breakTime = breakTime;
                existingEntry.workHours = workHours; // Calculate workHours
                existingEntry.project = project; 
                existingEntry.extraHoursReason = extraHoursReason;
                await existingEntry.save();
                return res.json({ success: true, message: 'Timesheet entry updated!' });
            } else {
                return res.json({ success: false, message: 'Timesheet submission cancelled.' }); 
            }
        } else { 
            const newTimesheetEntry = new Timesheet({
                userMail: userId,
                date: start, 
                startTime: start, 
                endTime: end,
                breakTime: breakTime, 
                workHours: workHours,
                project: project,
                extraHoursReason: extraHoursReason,
                financialYear: currentFinancialYear() 
            });
    
            await newTimesheetEntry.save();
            res.json({ success: true });
        }
    } catch (error) {
        console.error('Error saving timesheet:', error);
        res.status(500).json({ success: false, error: 'Failed to submit timesheet.' }); 
    }
});



// Get Timesheet Entries for a User (with filtering)
app.get('/api/timesheet/entries', async (req, res) => {
    try {
        const userId = req.session.user.id; 
        const { month, year } = req.query;

        const query = { userMail: userId };

        // Filter by month and year if provided
        if (month && year) {
            const startDate = new Date(year, month - 1, 1); 
            const endDate = new Date(year, month, 0); 
            query.date = { $gte: startDate, $lte: endDate };
        }

        const entries = await Timesheet.find(query);
        res.json(entries);
    } catch (error) {
        console.error('Error fetching timesheet entries:', error);
        res.status(500).json({ error: 'Failed to fetch timesheet entries.' });
    }
});


// ... (Admin Routes)
app.get('/api/admin/users', async (req, res) => {
    try {
        // Fetch all user details (excluding the password)
        const users = await User.find({}, '-Password').lean(); 
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

app.get('/api/financial-years', async (req, res) => {

});

// Get User Details for Admin (with all fields)
app.get('/api/admin/user/details/:id', async (req, res) => { 
    try {
        const { id } = req.params; 
        const user = await User.findById(id); 
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json(user); 
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ error: 'Failed to fetch user details.' });
    }
});

// Update User Details (Admin)
app.put('/api/admin/user/update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        const updatedUser = await User.findByIdAndUpdate(
            id,
            {
                ...updatedData,
                ModifiedBy: req.session.user.username, 
                ModifiedDate: Date.now()
            },
            { new: true }
        );
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ success: false, error: 'Failed to update user.' });
    }
});

// Create New User (Admin)
app.post('/api/admin/users', async (req, res) => {
    try {
        const newUserData = req.body;
        // Check for missing fields
        if (!newUserData.Name || !newUserData.Surname || !newUserData.Role || !newUserData.Mail 
            || !newUserData.Telephone_Code || !newUserData.Mobile_Number || !newUserData.Alternate_Email_Address 
            || !newUserData.Company_Name || !newUserData.Office_Location || !newUserData.Department
            || !newUserData.Employee_ID) {
            return res.status(400).json({ success: false, error: 'All fields are required.' });
        }

        // Check if the email already exists
        const existingUser = await User.findOne({ Mail: newUserData.Mail });
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'A user with this email already exists.' });
        }

        const newUser = new User(newUserData);
        await newUser.save();
        res.status(201).json({ success: true, user: newUser }); 
    } catch (error) {
        console.error('Error creating new user:', error);
        res.status(500).json({ success: false, error: 'Failed to create new user.' });
    }
});

// Admin Timesheet Data Retrieval (with monthly breakdown)
app.get('/api/admin/timesheet/entries/monthly', async (req, res) => { 
    try {
        const { year, month, userMail } = req.query;

        const query = {};
        if (year) query.financialYear = year;
        if (userMail) query['userMail.Mail'] = userMail;

        const startDate = new Date(year, month - 1, 1); 
        const endDate = new Date(year, month, 0); 
        query.date = { $gte: startDate, $lte: endDate }; 

        const entries = await Timesheet.aggregate([
            {
                $match: query
            },
            {
                $group: {
                    _id: {
                        userMail: '$userMail',
                        day: { $dayOfMonth: '$date' }
                    },
                    totalHours: { $sum: '$workHours' }, 
                    details: {
                        $push: {
                            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                            startTime: { $dateToString: { format: "%H:%M", date: "$startTime" } }, 
                            endTime: { $dateToString: { format: "%H:%M", date: "$endTime" } }, 
                            breakTime: '$breakTime',
                            workHours: '$workHours', 
                            project: '$project',
                            extraHoursReason: '$extraHoursReason' 
                        }
                    } 
                }
            },
            {
                $group: { 
                    _id: '$_id.userMail',
                    days: {
                        $push: {
                            day: '$_id.day',
                            totalHours: '$totalHours', 
                            details: '$details' 
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users', // Assuming your users collection is named 'users'
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userData'
                }
            },
            {
                $unwind: '$userData'
            }, 
            {
                $project: {
                    _id: 0,
                    userEmail: '$userData.Mail',
                    userName: '$userData.Username', 
                    days: 1
                }
            }
        ]);
        res.json(entries);
    } catch (error) {
        console.error('Error fetching monthly timesheet data:', error);
        res.status(500).json({ error: 'Failed to fetch timesheet data.' });
    }
});

// Export Timesheet Data to Excel (Admin)
app.get('/api/admin/timesheet/export', async (req, res) => {
    try {
        const { year, month } = req.query;

        const query = {};
        if (year) query.financialYear = year;

        // Filter by month if provided
        if (month) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            query.date = { $gte: startDate, $lte: endDate };
        }
        const entries = await Timesheet.find(query)
            .populate('userMail', 'Mail Username') 
            .lean(); 

        const formattedEntries = entries.map(entry => ({
            'User Email': entry.userMail.Mail,
            'User Name': entry.userMail.Username, 
            Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-', 
            'Start Time': entry.startTime ? new Date(entry.startTime).toLocaleTimeString() : '-',
            'End Time': entry.endTime ? new Date(entry.endTime).toLocaleTimeString() : '-', 
            'Break Time (hours)': entry.breakTime, 
            'Total Hours': entry.workHours,
            Project: entry.project,
            'Extra Hours Reason': entry.extraHoursReason || '-'
        }));

        const xls = json2xls(formattedEntries);
        const fileName = `timesheet_data_${year}${month ? `_${month}` : ''}.xlsx`; 

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`); 
        res.end(xls, 'binary'); 
    } catch (error) {
        console.error('Error exporting timesheet data:', error);
        res.status(500).json({ error: 'Failed to export timesheet data.' });
    }
});

// ... other routes 

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
