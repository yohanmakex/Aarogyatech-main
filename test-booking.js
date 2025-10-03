const axios = require('axios');

async function testBookingAPI() {
  const baseURL = 'http://localhost:3000';
  
  console.log('🧪 Testing Booking API...\n');
  
  try {
    // Test 1: Check API status
    console.log('1. Checking API status...');
    const statusResponse = await axios.get(`${baseURL}/api/status`);
    console.log('✅ API Status:', statusResponse.data.services.booking);
    
    // Test 2: Create a test booking
    console.log('\n2. Creating test booking...');
    // Create a future date for testing
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
    const dateString = futureDate.toISOString().split('T')[0];
    
    const bookingData = {
      studentId: 'TEST001',
      preferredDate: dateString,
      preferredTime: '14:00',
      sessionType: 'individual',
      concerns: 'Test booking for API verification',
      contactMethod: 'email',
      contactInfo: 'test@student.edu'
    };
    
    const createResponse = await axios.post(`${baseURL}/api/booking/appointments`, bookingData);
    console.log('✅ Booking created successfully!');
    console.log('Booking ID:', createResponse.data.booking.id);
    console.log('Status:', createResponse.data.booking.status);
    
    const bookingId = createResponse.data.booking.id;
    
    // Test 3: Get booking by ID
    console.log('\n3. Retrieving booking by ID...');
    const getResponse = await axios.get(`${baseURL}/api/booking/appointments/${bookingId}`);
    console.log('✅ Booking retrieved successfully!');
    console.log('Retrieved booking for:', getResponse.data.booking.contactInfo);
    
    // Test 4: Get all bookings
    console.log('\n4. Getting all bookings...');
    const listResponse = await axios.get(`${baseURL}/api/booking/appointments`);
    console.log('✅ Bookings list retrieved successfully!');
    console.log('Total bookings:', listResponse.data.bookings.length);
    
    // Test 5: Check availability for the booked date
    console.log('\n5. Checking availability...');
    const availabilityResponse = await axios.get(`${baseURL}/api/booking/availability?date=${bookingData.preferredDate}`);
    console.log('✅ Availability checked successfully!');
    console.log('Available slots:', availabilityResponse.data.availableSlots.length);
    console.log('Unavailable slots:', availabilityResponse.data.unavailableSlots);
    
    // Test 6: Get booking stats
    console.log('\n6. Getting booking statistics...');
    const statsResponse = await axios.get(`${baseURL}/api/booking/stats`);
    console.log('✅ Stats retrieved successfully!');
    console.log('Total bookings:', statsResponse.data.stats.total);
    console.log('By session type:', statsResponse.data.stats.bySessionType);
    
    console.log('\n🎉 All tests passed! The booking system is working correctly.');
    console.log('\n📊 Data Collection Summary:');
    console.log('- User data is being saved to: data/bookings.json');
    console.log('- Booking form now sends data to backend API');
    console.log('- Admin can access booking data via API endpoints');
    console.log('- Data includes: student info, preferences, concerns, contact details, timestamps');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  testBookingAPI();
}

module.exports = testBookingAPI;