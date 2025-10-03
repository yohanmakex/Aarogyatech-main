/*
 * AarogyaTech - AI-powered Mental Health Assistant
 * Booking Service - Handles counseling appointment bookings
 * 
 * Copyright (c) 2025 Rajiv Magadum
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying or distribution is strictly prohibited.
 * 
 * Author: Rajiv Magadum
 * Email: rajiv.magadum@gmail.com
 * Date: 2025
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class BookingService {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.bookingsFile = path.join(this.dataDir, 'bookings.json');
    this.initializeDataDirectory();
  }

  async initializeDataDirectory() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Initialize bookings file if it doesn't exist
      try {
        await fs.access(this.bookingsFile);
      } catch (error) {
        await fs.writeFile(this.bookingsFile, JSON.stringify([], null, 2));
      }
    } catch (error) {
      console.error('Error initializing data directory:', error);
    }
  }

  async loadBookings() {
    try {
      const data = await fs.readFile(this.bookingsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading bookings:', error);
      return [];
    }
  }

  async saveBookings(bookings) {
    try {
      await fs.writeFile(this.bookingsFile, JSON.stringify(bookings, null, 2));
    } catch (error) {
      console.error('Error saving bookings:', error);
      throw error;
    }
  }

  async createBooking(bookingData) {
    try {
      const bookings = await this.loadBookings();
      
      const newBooking = {
        id: uuidv4(),
        ...bookingData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      bookings.push(newBooking);
      await this.saveBookings(bookings);
      
      console.log('Booking created:', newBooking.id);
      return newBooking;
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  }

  async getBookingById(id) {
    try {
      const bookings = await this.loadBookings();
      return bookings.find(booking => booking.id === id);
    } catch (error) {
      console.error('Error getting booking by ID:', error);
      throw error;
    }
  }

  async getBookings(filters = {}, pagination = { limit: 50, offset: 0 }) {
    try {
      let bookings = await this.loadBookings();
      
      // Apply filters
      if (filters.status) {
        bookings = bookings.filter(booking => booking.status === filters.status);
      }
      
      if (filters.sessionType) {
        bookings = bookings.filter(booking => booking.sessionType === filters.sessionType);
      }
      
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        bookings = bookings.filter(booking => 
          new Date(booking.preferredDate) >= fromDate
        );
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        bookings = bookings.filter(booking => 
          new Date(booking.preferredDate) <= toDate
        );
      }

      // Sort by creation date (newest first)
      bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Apply pagination
      const total = bookings.length;
      const paginatedBookings = bookings.slice(
        pagination.offset, 
        pagination.offset + pagination.limit
      );
      
      return {
        items: paginatedBookings,
        total: total
      };
    } catch (error) {
      console.error('Error getting bookings:', error);
      throw error;
    }
  }

  async updateBookingStatus(id, updateData) {
    try {
      const bookings = await this.loadBookings();
      const bookingIndex = bookings.findIndex(booking => booking.id === id);
      
      if (bookingIndex === -1) {
        return null;
      }
      
      bookings[bookingIndex] = {
        ...bookings[bookingIndex],
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      
      await this.saveBookings(bookings);
      console.log('Booking status updated:', id);
      return bookings[bookingIndex];
    } catch (error) {
      console.error('Error updating booking status:', error);
      throw error;
    }
  }

  async cancelBooking(id, cancelData) {
    try {
      const updateData = {
        status: 'cancelled',
        ...cancelData,
        updatedAt: new Date().toISOString()
      };
      
      return await this.updateBookingStatus(id, updateData);
    } catch (error) {
      console.error('Error cancelling booking:', error);
      throw error;
    }
  }

  async getAvailability(date, sessionType = null) {
    try {
      const bookings = await this.loadBookings();
      
      // Define available time slots
      const allSlots = [
        '09:00', '10:00', '11:00', '12:00',
        '14:00', '15:00', '16:00', '17:00'
      ];
      
      // Find bookings for the specified date
      const dayBookings = bookings.filter(booking => 
        booking.preferredDate === date && 
        booking.status !== 'cancelled'
      );
      
      // Get unavailable slots
      const unavailableSlots = dayBookings.map(booking => booking.preferredTime);
      
      // Calculate available slots
      const availableSlots = allSlots.filter(slot => 
        !unavailableSlots.includes(slot)
      );
      
      return {
        slots: availableSlots,
        unavailableSlots: unavailableSlots,
        totalSlots: allSlots.length,
        availableCount: availableSlots.length
      };
    } catch (error) {
      console.error('Error getting availability:', error);
      throw error;
    }
  }

  async getBookingStats(filters = {}) {
    try {
      let bookings = await this.loadBookings();
      
      // Apply date filters
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        bookings = bookings.filter(booking => 
          new Date(booking.createdAt) >= fromDate
        );
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        bookings = bookings.filter(booking => 
          new Date(booking.createdAt) <= toDate
        );
      }
      
      // Calculate statistics
      const stats = {
        total: bookings.length,
        byStatus: {},
        bySessionType: {},
        byContactMethod: {},
        recentBookings: bookings
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 10)
      };
      
      // Count by status
      bookings.forEach(booking => {
        stats.byStatus[booking.status] = (stats.byStatus[booking.status] || 0) + 1;
      });
      
      // Count by session type
      bookings.forEach(booking => {
        stats.bySessionType[booking.sessionType] = (stats.bySessionType[booking.sessionType] || 0) + 1;
      });
      
      // Count by contact method
      bookings.forEach(booking => {
        stats.byContactMethod[booking.contactMethod] = (stats.byContactMethod[booking.contactMethod] || 0) + 1;
      });
      
      return stats;
    } catch (error) {
      console.error('Error getting booking stats:', error);
      throw error;
    }
  }

  async searchBookings(query) {
    try {
      const bookings = await this.loadBookings();
      const searchTerm = query.toLowerCase();
      
      return bookings.filter(booking => {
        return (
          booking.studentId?.toLowerCase().includes(searchTerm) ||
          booking.contactInfo?.toLowerCase().includes(searchTerm) ||
          booking.concerns?.toLowerCase().includes(searchTerm) ||
          booking.sessionType?.toLowerCase().includes(searchTerm)
        );
      });
    } catch (error) {
      console.error('Error searching bookings:', error);
      throw error;
    }
  }

  // Helper method for data export
  async exportBookings(format = 'json') {
    try {
      const bookings = await this.loadBookings();
      
      if (format === 'csv') {
        // Convert to CSV format
        const headers = [
          'ID', 'Student ID', 'Date', 'Time', 'Session Type', 
          'Contact Method', 'Contact Info', 'Status', 'Created At'
        ];
        
        const csvData = [headers.join(',')];
        bookings.forEach(booking => {
          const row = [
            booking.id,
            booking.studentId || '',
            booking.preferredDate,
            booking.preferredTime,
            booking.sessionType,
            booking.contactMethod,
            booking.contactInfo,
            booking.status,
            booking.createdAt
          ];
          csvData.push(row.join(','));
        });
        
        return csvData.join('\n');
      }
      
      return bookings;
    } catch (error) {
      console.error('Error exporting bookings:', error);
      throw error;
    }
  }
}

module.exports = BookingService;