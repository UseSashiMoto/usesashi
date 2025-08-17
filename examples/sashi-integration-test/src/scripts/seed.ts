import { getAllUsers, addUser, User } from '../services/user_service'

// Additional seed data for comprehensive testing
const seedUsers: User[] = [
    {
        name: "Alice Johnson",
        email: "alice@example.com", 
        password: "password123",
        role: "admin",
        preferences: {
            theme: "dark",
            notifications: true,
            language: "en"
        }
    },
    {
        name: "Bob Smith",
        email: "bob@example.com",
        password: "password123", 
        role: "user",
        preferences: {
            theme: "light",
            notifications: false,
            language: "en"
        }
    },
    {
        name: "Carol Davis",
        email: "carol@example.com",
        password: "password123",
        role: "moderator",
        preferences: {
            theme: "dark",
            notifications: true,
            language: "es"
        }
    },
    {
        name: "David Wilson",
        email: "david@example.com",
        password: "password123",
        role: "user",
        preferences: {
            theme: "light",
            notifications: true,
            language: "fr"
        }
    },
    {
        name: "Eva Brown",
        email: "eva@example.com",
        password: "password123",
        role: "user",
        preferences: {
            theme: "dark",
            notifications: false,
            language: "de"
        }
    }
]

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding...')
        
        // Check existing users
        const existingUsers = await getAllUsers()
        console.log(`📊 Found ${existingUsers.length} existing users`)
        
        // Add seed users if they don't exist
        let addedCount = 0
        
        for (const seedUser of seedUsers) {
            const userExists = existingUsers.some(
                user => user.data.email === seedUser.email
            )
            
            if (!userExists) {
                await addUser(seedUser)
                addedCount++
                console.log(`✅ Added user: ${seedUser.name} (${seedUser.email})`)
            } else {
                console.log(`⏭️  User already exists: ${seedUser.email}`)
            }
        }
        
        // Final summary
        const finalUserCount = await getAllUsers()
        console.log('')
        console.log(`🎉 Seeding completed!`)
        console.log(`📈 Added ${addedCount} new users`)
        console.log(`👥 Total users: ${finalUserCount.length}`)
        console.log('')
        console.log('Available test users:')
        
        finalUserCount.forEach((user, index) => {
            console.log(`${index + 1}. ${user.data.name} (${user.data.email}) - Role: ${user.data.role || 'user'}`)
        })
        
        console.log('')
        console.log('🔑 Test authentication tokens:')
        console.log('   - userone-session-token (regular user)')
        console.log('   - usertwo-session-token (regular user)')
        console.log('   - admin-session-token (admin user)')
        console.log('   - demo-session-token (demo user)')
        
    } catch (error) {
        console.error('❌ Database seeding failed:', error)
        process.exit(1)
    }
}

// Run seeding if this file is executed directly
if (require.main === module) {
    seedDatabase().then(() => {
        console.log('\\n✨ Seeding process completed successfully!')
        process.exit(0)
    }).catch((error) => {
        console.error('\\n💥 Seeding process failed:', error)
        process.exit(1)
    })
}

export { seedDatabase }