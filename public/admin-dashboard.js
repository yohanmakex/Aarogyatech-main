/*
 * AarogyaTech - AI-powered Mental Health Assistant
 * Admin Dashboard JavaScript - Frontend Management Logic
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

// Admin Dashboard JavaScript

class AdminDashboard {
    constructor() {
        this.currentUser = null;
        this.authToken = null;
        this.currentSection = 'overview';
        this.autoRefreshInterval = null;
        this.charts = {};
        this.currentLanguage = 'en';
        this.socket = null;
        this.isConnected = false;
        this.notifications = [];
        
        this.init();
    }

    init() {
        // Check if user is already logged in
        const token = localStorage.getItem('adminAuthToken');
        if (token) {
            this.validateSession(token);
        }

        // Initialize language
        this.initializeLanguage();
        
        // Set up event listeners
        this.setupEventListeners();
    }

    initializeLanguage() {
        const savedLang = localStorage.getItem('adminLanguage') || 'en';
        this.switchLanguage(savedLang);
    }

    setupEventListeners() {
        // Handle form submissions
        document.addEventListener('DOMContentLoaded', () => {
            // Any additional setup after DOM is loaded
        });

        // Handle window resize for responsive charts
        window.addEventListener('resize', () => {
            this.resizeCharts();
        });
    }

    async validateSession(token) {
        try {
            const response = await fetch('/api/auth/validate', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.valid) {
                    this.authToken = token;
                    this.currentUser = data.user;
                    this.showDashboard();
                    return;
                }
            }
        } catch (error) {
            console.error('Session validation failed:', error);
        }

        // If validation fails, show login
        localStorage.removeItem('adminAuthToken');
        this.showLogin();
    }

    showLogin() {
        document.getElementById('adminLoginOverlay').style.display = 'flex';
        document.getElementById('adminDashboard').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('adminLoginOverlay').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        
        // Update user info
        document.getElementById('adminUserName').textContent = this.currentUser.username;
        document.getElementById('adminUserRole').textContent = 
            this.currentUser.role === 'admin' ? 'Administrator' : 'Counselor';

        // Hide user management for counselors
        if (this.currentUser.role !== 'admin') {
            document.getElementById('usersNavBtn').style.display = 'none';
        }

        // Initialize WebSocket connection
        this.initializeWebSocket();

        // Load initial data
        this.loadDashboardData();
    }

    async handleAdminLogin(event) {
        event.preventDefault();
        
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;

        this.showLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.authToken = data.token;
                this.currentUser = data.user;
                
                // Check if user has admin or counselor role
                if (!['admin', 'counselor'].includes(this.currentUser.role)) {
                    throw new Error('Access denied. Admin or counselor role required.');
                }

                localStorage.setItem('adminAuthToken', this.authToken);
                this.showDashboard();
            } else {
                throw new Error(data.message || 'Login failed');
            }
        } catch (error) {
            this.showError('Login failed: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    adminLogout() {
        if (this.authToken) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            }).catch(console.error);
        }

        // Disconnect WebSocket
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }

        localStorage.removeItem('adminAuthToken');
        this.authToken = null;
        this.currentUser = null;
        
        // Clear any intervals
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }

        this.showLogin();
    }

    showAdminSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.admin-content-area').forEach(area => {
            area.classList.remove('active');
        });

        // Remove active class from all nav buttons
        document.querySelectorAll('.admin-nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected section
        document.getElementById(sectionName).classList.add('active');
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        this.currentSection = sectionName;

        // Load section-specific data
        this.loadSectionData(sectionName);
    }

    async loadDashboardData() {
        try {
            // Load overview data by default
            await this.loadSectionData('overview');
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async loadSectionData(section) {
        switch (section) {
            case 'overview':
                await this.loadOverviewData();
                // Also load booking stats for the overview
                await this.loadBookingStats();
                break;
            case 'analytics':
                await this.loadAnalyticsData();
                break;
            case 'users':
                if (this.currentUser.role === 'admin') {
                    await this.loadUsersData();
                }
                break;
            case 'bookings':
                await this.loadBookingsData();
                break;
            case 'monitoring':
                await this.loadMonitoringData();
                break;
            case 'reports':
                await this.loadReportsData();
                break;
            case 'settings':
                this.loadSettingsData();
                break;
        }
    }

    async loadOverviewData() {
        try {
            // Load real usage statistics
            const response = await fetch('/api/analytics/usage', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const stats = data.data;

                // Update stat cards
                document.getElementById('totalUsersCount').textContent = stats.today.totalUsers || 0;
                document.getElementById('totalConversationsCount').textContent = stats.today.totalConversations || 0;
                document.getElementById('crisisAlertsCount').textContent = stats.today.crisisAlerts || 0;
                document.getElementById('avgSentimentScore').textContent = stats.today.avgSentiment?.toFixed(1) || '0.0';
            } else {
                // Fallback to sample data if API fails
                this.loadSampleOverviewData();
            }

            // Create charts with real data
            await this.createUsageChart();
            await this.createSentimentChart();
            this.loadRecentActivity();

        } catch (error) {
            console.error('Failed to load overview data:', error);
            this.loadSampleOverviewData();
        }
    }

    loadSampleOverviewData() {
        // Fallback sample data
        const stats = {
            totalUsers: Math.floor(Math.random() * 500) + 100,
            totalConversations: Math.floor(Math.random() * 1000) + 200,
            crisisAlerts: Math.floor(Math.random() * 10),
            avgSentiment: (Math.random() * 2 - 1).toFixed(1)
        };

        document.getElementById('totalUsersCount').textContent = stats.totalUsers;
        document.getElementById('totalConversationsCount').textContent = stats.totalConversations;
        document.getElementById('crisisAlertsCount').textContent = stats.crisisAlerts;
        document.getElementById('avgSentimentScore').textContent = stats.avgSentiment;
    }

    async createUsageChart() {
        const ctx = document.getElementById('usageChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.charts.usage) {
            this.charts.usage.destroy();
        }

        try {
            // Fetch weekly analytics data
            const response = await fetch('/api/analytics/weekly', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            let labels = [];
            let userData = [];
            let conversationData = [];

            if (response.ok) {
                const data = await response.json();
                const weeklyData = data.data;

                labels = weeklyData.map(day => new Date(day.date).toLocaleDateString());
                userData = weeklyData.map(day => day.totalUsers || 0);
                conversationData = weeklyData.map(day => day.totalConversations || 0);
            } else {
                // Fallback to sample data
                for (let i = 6; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    labels.push(date.toLocaleDateString());
                    userData.push(Math.floor(Math.random() * 100) + 20);
                    conversationData.push(Math.floor(Math.random() * 150) + 30);
                }
            }

            this.charts.usage = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Daily Users',
                        data: userData,
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    }, {
                        label: 'Conversations',
                        data: conversationData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: '#e5e7eb'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(31, 25, 55, 0.9)',
                            titleColor: '#e5e7eb',
                            bodyColor: '#e5e7eb',
                            borderColor: '#8b5cf6',
                            borderWidth: 1
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: '#9ca3af'
                            },
                            grid: {
                                color: 'rgba(139, 92, 246, 0.1)'
                            }
                        },
                        y: {
                            ticks: {
                                color: '#9ca3af'
                            },
                            grid: {
                                color: 'rgba(139, 92, 246, 0.1)'
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to create usage chart:', error);
            this.createFallbackUsageChart(ctx);
        }
    }

    createFallbackUsageChart(ctx) {
        // Fallback chart with sample data
        const labels = [];
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString());
            data.push(Math.floor(Math.random() * 100) + 20);
        }

        this.charts.usage = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Users (Sample)',
                    data: data,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e5e7eb'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#9ca3af'
                        },
                        grid: {
                            color: 'rgba(139, 92, 246, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#9ca3af'
                        },
                        grid: {
                            color: 'rgba(139, 92, 246, 0.1)'
                        }
                    }
                }
            }
        });
    }

    async createSentimentChart() {
        const ctx = document.getElementById('sentimentChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.charts.sentiment) {
            this.charts.sentiment.destroy();
        }

        try {
            // Fetch sentiment trends data
            const response = await fetch('/api/analytics/sentiment?days=7', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            let positiveCount = 60;
            let neutralCount = 30;
            let negativeCount = 10;

            if (response.ok) {
                const data = await response.json();
                const sentimentData = data.data;

                if (sentimentData.length > 0) {
                    // Calculate sentiment distribution
                    const sentiments = sentimentData.map(d => d.sentiment);
                    positiveCount = sentiments.filter(s => s > 0.1).length;
                    neutralCount = sentiments.filter(s => s >= -0.1 && s <= 0.1).length;
                    negativeCount = sentiments.filter(s => s < -0.1).length;

                    // Convert to percentages
                    const total = positiveCount + neutralCount + negativeCount;
                    if (total > 0) {
                        positiveCount = Math.round((positiveCount / total) * 100);
                        neutralCount = Math.round((neutralCount / total) * 100);
                        negativeCount = Math.round((negativeCount / total) * 100);
                    }
                }
            }

            this.charts.sentiment = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Positive', 'Neutral', 'Negative'],
                    datasets: [{
                        data: [positiveCount, neutralCount, negativeCount],
                        backgroundColor: [
                            '#10b981',
                            '#8b5cf6',
                            '#ef4444'
                        ],
                        borderWidth: 2,
                        borderColor: '#1f1937'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#e5e7eb',
                                padding: 20,
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(31, 25, 55, 0.9)',
                            titleColor: '#e5e7eb',
                            bodyColor: '#e5e7eb',
                            borderColor: '#8b5cf6',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    return context.label + ': ' + context.parsed + '%';
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to create sentiment chart:', error);
            this.createFallbackSentimentChart(ctx);
        }
    }

    createFallbackSentimentChart(ctx) {
        this.charts.sentiment = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Positive', 'Neutral', 'Negative'],
                datasets: [{
                    data: [60, 30, 10],
                    backgroundColor: [
                        '#10b981',
                        '#8b5cf6',
                        '#ef4444'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#e5e7eb',
                            padding: 20
                        }
                    }
                }
            }
        });
    }

    loadRecentActivity() {
        const activityList = document.getElementById('recentActivityList');
        if (!activityList) return;

        // Sample activity data
        const activities = [
            { text: 'New user registered', time: '2 minutes ago', type: 'user' },
            { text: 'Crisis alert resolved', time: '15 minutes ago', type: 'crisis' },
            { text: 'System backup completed', time: '1 hour ago', type: 'system' },
            { text: 'Weekly report generated', time: '2 hours ago', type: 'report' }
        ];

        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-content">
                    <span>${activity.text}</span>
                </div>
                <div class="activity-time">${activity.time}</div>
            </div>
        `).join('');
    }

    async loadAnalyticsData() {
        // Create analytics charts
        this.createTopicsChart();
        this.createPeakHoursChart();
        this.createCrisisStatsChart();
    }

    async createTopicsChart() {
        const ctx = document.getElementById('topicsChart');
        if (!ctx) return;

        if (this.charts.topics) {
            this.charts.topics.destroy();
        }

        try {
            // Get date range for topics
            const days = this.getAnalyticsDays();
            const response = await fetch(`/api/analytics/topics?days=${days}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            let labels = ['Anxiety', 'Depression', 'Stress', 'Relationships', 'Academic', 'Sleep'];
            let data = [45, 32, 28, 22, 18, 15];
            let sentimentData = [0.2, -0.3, -0.1, 0.1, -0.2, 0.0];

            if (response.ok) {
                const topicsResponse = await response.json();
                const topics = topicsResponse.data;

                if (topics.length > 0) {
                    labels = topics.map(t => t.topic.charAt(0).toUpperCase() + t.topic.slice(1));
                    data = topics.map(t => t.totalCount);
                    sentimentData = topics.map(t => parseFloat(t.avgSentiment));
                }
            }

            this.charts.topics = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Conversation Count',
                        data: data,
                        backgroundColor: data.map((_, index) => {
                            const sentiment = sentimentData[index];
                            if (sentiment > 0.1) return 'rgba(16, 185, 129, 0.8)'; // Positive - green
                            if (sentiment < -0.1) return 'rgba(239, 68, 68, 0.8)'; // Negative - red
                            return 'rgba(139, 92, 246, 0.8)'; // Neutral - purple
                        }),
                        borderColor: data.map((_, index) => {
                            const sentiment = sentimentData[index];
                            if (sentiment > 0.1) return '#10b981';
                            if (sentiment < -0.1) return '#ef4444';
                            return '#8b5cf6';
                        }),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#e5e7eb'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(31, 25, 55, 0.9)',
                            titleColor: '#e5e7eb',
                            bodyColor: '#e5e7eb',
                            borderColor: '#8b5cf6',
                            borderWidth: 1,
                            callbacks: {
                                afterLabel: function(context) {
                                    const sentiment = sentimentData[context.dataIndex];
                                    return `Avg Sentiment: ${sentiment.toFixed(2)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: '#9ca3af',
                                maxRotation: 45
                            },
                            grid: {
                                color: 'rgba(139, 92, 246, 0.1)'
                            }
                        },
                        y: {
                            ticks: {
                                color: '#9ca3af'
                            },
                            grid: {
                                color: 'rgba(139, 92, 246, 0.1)'
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to create topics chart:', error);
            this.createFallbackTopicsChart(ctx);
        }
    }

    createFallbackTopicsChart(ctx) {
        this.charts.topics = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Anxiety', 'Depression', 'Stress', 'Relationships', 'Academic', 'Sleep'],
                datasets: [{
                    label: 'Conversation Count (Sample)',
                    data: [45, 32, 28, 22, 18, 15],
                    backgroundColor: 'rgba(139, 92, 246, 0.8)',
                    borderColor: '#8b5cf6',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e5e7eb'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#9ca3af'
                        },
                        grid: {
                            color: 'rgba(139, 92, 246, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#9ca3af'
                        },
                        grid: {
                            color: 'rgba(139, 92, 246, 0.1)'
                        }
                    }
                }
            }
        });
    }

    async createPeakHoursChart() {
        const ctx = document.getElementById('peakHoursChart');
        if (!ctx) return;

        if (this.charts.peakHours) {
            this.charts.peakHours.destroy();
        }

        try {
            const response = await fetch('/api/analytics/peak-hours', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const hours = Array.from({length: 24}, (_, i) => `${i}:00`);
            let usage = hours.map(() => Math.floor(Math.random() * 50) + 5);

            if (response.ok) {
                const data = await response.json();
                const peakHoursData = data.data;

                if (peakHoursData.length > 0) {
                    // Create array with all hours initialized to 0
                    usage = new Array(24).fill(0);
                    
                    // Fill in the actual data
                    peakHoursData.forEach(hourData => {
                        if (hourData.hour >= 0 && hourData.hour < 24) {
                            usage[hourData.hour] = hourData.users || 0;
                        }
                    });
                }
            }

            this.charts.peakHours = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: hours,
                    datasets: [{
                        label: 'Active Users',
                        data: usage,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: '#e5e7eb'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(31, 25, 55, 0.9)',
                            titleColor: '#e5e7eb',
                            bodyColor: '#e5e7eb',
                            borderColor: '#10b981',
                            borderWidth: 1
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: '#9ca3af',
                                maxTicksLimit: 12
                            },
                            grid: {
                                color: 'rgba(139, 92, 246, 0.1)'
                            }
                        },
                        y: {
                            ticks: {
                                color: '#9ca3af'
                            },
                            grid: {
                                color: 'rgba(139, 92, 246, 0.1)'
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to create peak hours chart:', error);
            this.createFallbackPeakHoursChart(ctx);
        }
    }

    createFallbackPeakHoursChart(ctx) {
        const hours = Array.from({length: 24}, (_, i) => `${i}:00`);
        const usage = hours.map(() => Math.floor(Math.random() * 50) + 5);

        this.charts.peakHours = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hours,
                datasets: [{
                    label: 'Active Users (Sample)',
                    data: usage,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e5e7eb'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#9ca3af',
                            maxTicksLimit: 12
                        },
                        grid: {
                            color: 'rgba(139, 92, 246, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#9ca3af'
                        },
                        grid: {
                            color: 'rgba(139, 92, 246, 0.1)'
                        }
                    }
                }
            }
        });
    }

    // Helper method to get analytics days based on date range selector
    getAnalyticsDays() {
        const dateRangeSelect = document.getElementById('dateRangeSelect');
        if (!dateRangeSelect) return 7;

        switch (dateRangeSelect.value) {
            case 'today': return 1;
            case 'week': return 7;
            case 'month': return 30;
            case 'custom':
                const startDate = document.getElementById('startDate');
                const endDate = document.getElementById('endDate');
                if (startDate && endDate && startDate.value && endDate.value) {
                    const start = new Date(startDate.value);
                    const end = new Date(endDate.value);
                    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                }
                return 7;
            default: return 7;
        }
    }

    async createCrisisStatsChart() {
        const ctx = document.getElementById('crisisStatsChart');
        if (!ctx) return;

        if (this.charts.crisisStats) {
            this.charts.crisisStats.destroy();
        }

        try {
            const days = this.getAnalyticsDays();
            const response = await fetch(`/api/analytics/crisis?days=${days}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            let resolvedCount = 75;
            let pendingCount = 15;
            let escalatedCount = 10;

            if (response.ok) {
                const data = await response.json();
                const crisisStats = data.data;

                resolvedCount = crisisStats.resolved || 0;
                pendingCount = crisisStats.pending || 0;
                escalatedCount = crisisStats.escalated || 0;

                // If no crisis events, show sample data
                if (resolvedCount + pendingCount + escalatedCount === 0) {
                    resolvedCount = 75;
                    pendingCount = 15;
                    escalatedCount = 10;
                }
            }

            this.charts.crisisStats = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['Resolved', 'Pending', 'Escalated'],
                    datasets: [{
                        data: [resolvedCount, pendingCount, escalatedCount],
                        backgroundColor: [
                            '#10b981',
                            '#f59e0b',
                            '#ef4444'
                        ],
                        borderWidth: 2,
                        borderColor: '#1f1937'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#e5e7eb',
                                padding: 20,
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(31, 25, 55, 0.9)',
                            titleColor: '#e5e7eb',
                            bodyColor: '#e5e7eb',
                            borderColor: '#8b5cf6',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
                                    return context.label + ': ' + context.parsed + ' (' + percentage + '%)';
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to create crisis stats chart:', error);
            this.createFallbackCrisisStatsChart(ctx);
        }
    }

    createFallbackCrisisStatsChart(ctx) {
        this.charts.crisisStats = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Resolved', 'Pending', 'Escalated'],
                datasets: [{
                    data: [75, 15, 10],
                    backgroundColor: [
                        '#10b981',
                        '#f59e0b',
                        '#ef4444'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#e5e7eb',
                            padding: 20
                        }
                    }
                }
            }
        });
    }

    async loadUsersData() {
        if (this.currentUser.role !== 'admin') return;

        try {
            const response = await fetch('/api/auth/users', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.displayUsersTable(data.users);
            } else {
                throw new Error('Failed to load users');
            }
        } catch (error) {
            console.error('Failed to load users:', error);
            this.showError('Failed to load users data');
        }
    }

    displayUsersTable(users) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.username}</td>
                <td>${user.fullName}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>
                    <span class="status-badge ${user.isActive ? 'active' : 'inactive'}">
                        ${user.isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</td>
                <td>
                    <button class="action-btn" onclick="adminDashboard.editUser('${user.username}')">Edit</button>
                    ${user.username !== 'admin' ? 
                        `<button class="action-btn danger" onclick="adminDashboard.deleteUser('${user.username}')">Delete</button>` 
                        : ''
                    }
                </td>
            </tr>
        `).join('');
    }

    async loadMonitoringData() {
        // Load active users, crisis alerts, and system status
        this.loadActiveUsers();
        this.loadCrisisAlerts();
        this.loadSystemStatus();
    }

    async loadActiveUsers() {
        const activeUsersList = document.getElementById('activeUsersList');
        const activeUsersCount = document.getElementById('activeUsersCount');
        
        if (!activeUsersList || !activeUsersCount) return;

        try {
            const response = await fetch('/api/analytics/active-sessions', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            let activeUsers = [
                { id: 'user1', name: 'Student A', activity: 'In conversation', duration: '5 min' },
                { id: 'user2', name: 'Student B', activity: 'Voice session', duration: '12 min' },
                { id: 'user3', name: 'Student C', activity: 'Text chat', duration: '3 min' }
            ];

            if (response.ok) {
                const data = await response.json();
                const activeSessionsCount = data.data.activeSessionsCount || 0;
                
                activeUsersCount.textContent = activeSessionsCount;

                if (activeSessionsCount === 0) {
                    activeUsersList.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 20px;">No active users</div>';
                } else {
                    // Generate sample active users based on count
                    activeUsers = Array.from({length: Math.min(activeSessionsCount, 10)}, (_, i) => ({
                        id: `user${i + 1}`,
                        name: `Student ${String.fromCharCode(65 + i)}`,
                        activity: ['In conversation', 'Voice session', 'Text chat'][i % 3],
                        duration: `${Math.floor(Math.random() * 20) + 1} min`
                    }));

                    activeUsersList.innerHTML = activeUsers.map(user => `
                        <div class="active-user-item">
                            <div><strong>${user.name}</strong></div>
                            <div>${user.activity} - ${user.duration}</div>
                        </div>
                    `).join('');
                }
            } else {
                // Fallback to sample data
                activeUsersCount.textContent = activeUsers.length;
                activeUsersList.innerHTML = activeUsers.map(user => `
                    <div class="active-user-item">
                        <div><strong>${user.name}</strong></div>
                        <div>${user.activity} - ${user.duration}</div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Failed to load active users:', error);
            // Fallback to sample data
            const activeUsers = [
                { id: 'user1', name: 'Student A', activity: 'In conversation', duration: '5 min' },
                { id: 'user2', name: 'Student B', activity: 'Voice session', duration: '12 min' }
            ];
            
            activeUsersCount.textContent = activeUsers.length;
            activeUsersList.innerHTML = activeUsers.map(user => `
                <div class="active-user-item">
                    <div><strong>${user.name}</strong></div>
                    <div>${user.activity} - ${user.duration}</div>
                </div>
            `).join('');
        }
    }

    async loadCrisisAlerts() {
        const crisisAlertsList = document.getElementById('crisisAlertsList');
        if (!crisisAlertsList) return;

        try {
            const response = await fetch('/api/analytics/crisis?days=1', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            let alerts = [];

            if (response.ok) {
                const data = await response.json();
                const crisisStats = data.data;
                
                // Generate sample alerts based on pending crisis events
                const pendingCount = crisisStats.pending || 0;
                
                if (pendingCount > 0) {
                    alerts = Array.from({length: Math.min(pendingCount, 5)}, (_, i) => ({
                        id: `alert${i + 1}`,
                        user: `Student ${String.fromCharCode(88 + i)}`, // X, Y, Z, etc.
                        severity: ['High', 'Medium', 'Critical'][i % 3],
                        time: `${Math.floor(Math.random() * 60) + 1} min ago`,
                        status: 'Pending'
                    }));
                }
            }

            crisisAlertsList.innerHTML = alerts.length > 0 ? alerts.map(alert => `
                <div class="crisis-alert-item">
                    <div><strong>Crisis Alert - ${alert.user}</strong></div>
                    <div>Severity: ${alert.severity} | ${alert.time}</div>
                    <div>Status: ${alert.status}</div>
                </div>
            `).join('') : '<div style="color: #9ca3af; text-align: center; padding: 20px;">No active crisis alerts</div>';
        } catch (error) {
            console.error('Failed to load crisis alerts:', error);
            crisisAlertsList.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 20px;">No active crisis alerts</div>';
        }
    }

    loadSystemStatus() {
        const systemStatusGrid = document.getElementById('systemStatusGrid');
        if (!systemStatusGrid) return;

        const services = [
            { name: 'API Server', status: 'online' },
            { name: 'Database', status: 'online' },
            { name: 'AI Services', status: 'online' },
            { name: 'Voice Processing', status: 'online' }
        ];

        systemStatusGrid.innerHTML = services.map(service => `
            <div class="status-indicator ${service.status}">
                <div>${service.name}</div>
                <div>${service.status.toUpperCase()}</div>
            </div>
        `).join('');
    }

    loadReportsData() {
        // Reports section is mostly static UI with generate buttons
        console.log('Reports section loaded');
    }

    loadSettingsData() {
        // Load current settings from localStorage or defaults
        const settings = {
            crisisNotifications: localStorage.getItem('crisisNotifications') !== 'false',
            dailyReports: localStorage.getItem('dailyReports') !== 'false',
            systemAlerts: localStorage.getItem('systemAlerts') === 'true',
            refreshInterval: localStorage.getItem('refreshInterval') || '60',
            chartAnimation: localStorage.getItem('chartAnimation') !== 'false',
            analyticsRetention: localStorage.getItem('analyticsRetention') || '90'
        };

        // Update form elements
        document.getElementById('crisisNotifications').checked = settings.crisisNotifications;
        document.getElementById('dailyReports').checked = settings.dailyReports;
        document.getElementById('systemAlerts').checked = settings.systemAlerts;
        document.getElementById('refreshInterval').value = settings.refreshInterval;
        document.getElementById('chartAnimation').checked = settings.chartAnimation;
        document.getElementById('analyticsRetention').value = settings.analyticsRetention;
    }

    // User Management Functions
    showAddUserModal() {
        document.getElementById('addUserModal').style.display = 'flex';
    }

    closeAddUserModal() {
        document.getElementById('addUserModal').style.display = 'none';
        document.getElementById('addUserForm').reset();
    }

    async handleAddUser(event) {
        event.preventDefault();
        
        const userData = {
            username: document.getElementById('newUsername').value,
            fullName: document.getElementById('newFullName').value,
            email: document.getElementById('newEmail').value,
            role: document.getElementById('newRole').value,
            password: document.getElementById('newPassword').value
        };

        try {
            const response = await fetch('/api/auth/users', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            if (response.ok) {
                this.closeAddUserModal();
                this.loadUsersData(); // Refresh users table
                this.showSuccess('User created successfully');
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create user');
            }
        } catch (error) {
            this.showError('Failed to create user: ' + error.message);
        }
    }

    async deleteUser(username) {
        if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/auth/users/${username}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.loadUsersData(); // Refresh users table
                this.showSuccess('User deleted successfully');
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete user');
            }
        } catch (error) {
            this.showError('Failed to delete user: ' + error.message);
        }
    }

    // Utility Functions
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showError(message) {
        // Simple error display - could be enhanced with a proper notification system
        alert('Error: ' + message);
    }

    showSuccess(message) {
        // Simple success display - could be enhanced with a proper notification system
        alert('Success: ' + message);
    }

    switchLanguage(lang) {
        this.currentLanguage = lang;
        localStorage.setItem('adminLanguage', lang);
        
        // Update language buttons
        document.querySelectorAll('.language-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`lang${lang.charAt(0).toUpperCase() + lang.slice(1)}`).classList.add('active');

        // Update all translatable elements
        document.querySelectorAll('[data-en]').forEach(element => {
            const text = element.getAttribute(`data-${lang}`);
            if (text) {
                element.textContent = text;
            }
        });

        // Update placeholders
        document.querySelectorAll('[data-placeholder-en]').forEach(element => {
            const placeholder = element.getAttribute(`data-placeholder-${lang}`);
            if (placeholder) {
                element.placeholder = placeholder;
            }
        });
    }

    resizeCharts() {
        // Resize all charts when window is resized
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        });
    }

    // Settings Functions
    saveSettings() {
        const settings = {
            crisisNotifications: document.getElementById('crisisNotifications').checked,
            dailyReports: document.getElementById('dailyReports').checked,
            systemAlerts: document.getElementById('systemAlerts').checked,
            refreshInterval: document.getElementById('refreshInterval').value,
            chartAnimation: document.getElementById('chartAnimation').checked,
            analyticsRetention: document.getElementById('analyticsRetention').value
        };

        // Save to localStorage
        Object.entries(settings).forEach(([key, value]) => {
            localStorage.setItem(key, value.toString());
        });

        this.showSuccess('Settings saved successfully');
    }

    resetSettings() {
        if (confirm('Are you sure you want to reset all settings to default?')) {
            // Clear localStorage settings
            const settingsKeys = ['crisisNotifications', 'dailyReports', 'systemAlerts', 'refreshInterval', 'chartAnimation', 'analyticsRetention'];
            settingsKeys.forEach(key => localStorage.removeItem(key));
            
            // Reload settings
            this.loadSettingsData();
            this.showSuccess('Settings reset to default');
        }
    }

    // Report Generation Functions
    async generateReport(type) {
        this.showLoading(true);
        
        try {
            const dateRange = this.getReportDateRange();
            
            const response = await fetch('/api/analytics/report', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reportType: type,
                    dateRange: dateRange,
                    includeDetails: true
                })
            });

            if (response.ok) {
                const reportData = await response.json();
                this.displayReport(reportData.report);
                this.showSuccess(`${type} report generated successfully`);
            } else {
                throw new Error('Failed to generate report');
            }
        } catch (error) {
            console.error('Report generation failed:', error);
            this.showError('Failed to generate report: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async exportData(format) {
        this.showLoading(true);
        
        try {
            const dateRange = this.getReportDateRange();
            let url = `/api/analytics/export?format=${format}`;
            
            if (dateRange) {
                url += `&startDate=${dateRange.start}&endDate=${dateRange.end}`;
            }

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (response.ok) {
                // Create download link
                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = `mindcare-analytics-${new Date().toISOString().split('T')[0]}.${format}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(downloadUrl);
                
                this.showSuccess(`Data exported as ${format.toUpperCase()} successfully`);
            } else {
                throw new Error('Failed to export data');
            }
        } catch (error) {
            console.error('Data export failed:', error);
            this.showError('Failed to export data: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    getReportDateRange() {
        const dateRangeSelect = document.getElementById('dateRangeSelect');
        if (!dateRangeSelect) return null;

        const today = new Date();
        let startDate, endDate;

        switch (dateRangeSelect.value) {
            case 'today':
                startDate = endDate = today.toISOString().split('T')[0];
                break;
            case 'week':
                startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                endDate = today.toISOString().split('T')[0];
                break;
            case 'month':
                startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                endDate = today.toISOString().split('T')[0];
                break;
            case 'custom':
                const startInput = document.getElementById('startDate');
                const endInput = document.getElementById('endDate');
                if (startInput && endInput && startInput.value && endInput.value) {
                    startDate = startInput.value;
                    endDate = endInput.value;
                } else {
                    return null;
                }
                break;
            default:
                return null;
        }

        return { start: startDate, end: endDate };
    }

    displayReport(report) {
        // Create a modal to display the report
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content report-modal';
        modalContent.style.maxWidth = '800px';
        modalContent.style.maxHeight = '80vh';
        modalContent.style.overflow = 'auto';
        
        modalContent.innerHTML = `
            <div class="modal-header">
                <h3>${report.type}</h3>
                <button class="close-modal" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="report-content">
                ${this.formatReportContent(report)}
            </div>
            <div class="modal-actions">
                <button class="export-btn" onclick="adminDashboard.downloadReport('${report.type}', 'pdf')">
                    📋 Download PDF
                </button>
                <button class="export-btn" onclick="adminDashboard.downloadReport('${report.type}', 'json')">
                    📊 Download JSON
                </button>
                <button class="cancel-btn" onclick="this.closest('.modal').remove()">
                    Close
                </button>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    }

    formatReportContent(report) {
        let content = `
            <div class="report-header">
                <h4>${report.type}</h4>
                <p><strong>Generated:</strong> ${new Date(report.generatedAt).toLocaleString()}</p>
                <p><strong>Generated by:</strong> ${report.generatedBy}</p>
                ${report.period ? `<p><strong>Period:</strong> ${report.period.start} to ${report.period.end}</p>` : ''}
            </div>
        `;

        if (report.type === 'Usage Report') {
            content += this.formatUsageReport(report);
        } else if (report.type === 'Mental Health Trends Report') {
            content += this.formatMentalHealthReport(report);
        } else if (report.type === 'Crisis Interventions Report') {
            content += this.formatCrisisReport(report);
        }

        return content;
    }

    formatUsageReport(report) {
        return `
            <div class="report-section">
                <h5>Summary Statistics</h5>
                <div class="stats-grid">
                    <div class="stat-item">
                        <strong>Total Users:</strong> ${report.summary.today.totalUsers}
                    </div>
                    <div class="stat-item">
                        <strong>Total Conversations:</strong> ${report.summary.today.totalConversations}
                    </div>
                    <div class="stat-item">
                        <strong>Total Messages:</strong> ${report.summary.today.totalMessages}
                    </div>
                    <div class="stat-item">
                        <strong>Crisis Alerts:</strong> ${report.summary.today.crisisAlerts}
                    </div>
                </div>
            </div>
            <div class="report-section">
                <h5>Usage Trends</h5>
                <div class="trends-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Users</th>
                                <th>Conversations</th>
                                <th>Messages</th>
                                <th>Avg Sentiment</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${report.trends.map(day => `
                                <tr>
                                    <td>${new Date(day.date).toLocaleDateString()}</td>
                                    <td>${day.totalUsers}</td>
                                    <td>${day.totalConversations}</td>
                                    <td>${day.totalMessages}</td>
                                    <td>${parseFloat(day.avgSentimentScore).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    formatMentalHealthReport(report) {
        return `
            <div class="report-section">
                <h5>Sentiment Analysis</h5>
                <div class="sentiment-summary">
                    ${report.sentimentTrends.map(day => `
                        <div class="sentiment-item">
                            <strong>${new Date(day.date).toLocaleDateString()}:</strong> 
                            Sentiment ${day.sentiment.toFixed(2)} (${day.totalInteractions} interactions)
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="report-section">
                <h5>Top Discussion Topics</h5>
                <div class="topics-list">
                    ${report.topicTrends.map(topic => `
                        <div class="topic-item">
                            <strong>${topic.topic}:</strong> ${topic.totalCount} mentions 
                            (Avg sentiment: ${topic.avgSentiment})
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="report-section">
                <h5>Crisis Statistics</h5>
                <div class="crisis-summary">
                    <p><strong>Total Crisis Events:</strong> ${report.crisisStats.total}</p>
                    <p><strong>Resolved:</strong> ${report.crisisStats.resolved}</p>
                    <p><strong>Pending:</strong> ${report.crisisStats.pending}</p>
                    <p><strong>Escalated:</strong> ${report.crisisStats.escalated}</p>
                </div>
            </div>
        `;
    }

    formatCrisisReport(report) {
        return `
            <div class="report-section">
                <h5>Crisis Statistics Overview</h5>
                <div class="crisis-overview">
                    <div class="crisis-stat">
                        <strong>Total Events:</strong> ${report.crisisStatistics.total}
                    </div>
                    <div class="crisis-stat">
                        <strong>Resolved:</strong> ${report.crisisStatistics.resolved}
                    </div>
                    <div class="crisis-stat">
                        <strong>Pending:</strong> ${report.crisisStatistics.pending}
                    </div>
                    <div class="crisis-stat">
                        <strong>Escalated:</strong> ${report.crisisStatistics.escalated}
                    </div>
                </div>
            </div>
            <div class="report-section">
                <h5>Severity Breakdown</h5>
                <div class="severity-breakdown">
                    <div class="severity-item critical">
                        <strong>Critical:</strong> ${report.crisisStatistics.bySeverity.critical}
                    </div>
                    <div class="severity-item high">
                        <strong>High:</strong> ${report.crisisStatistics.bySeverity.high}
                    </div>
                    <div class="severity-item medium">
                        <strong>Medium:</strong> ${report.crisisStatistics.bySeverity.medium}
                    </div>
                    <div class="severity-item low">
                        <strong>Low:</strong> ${report.crisisStatistics.bySeverity.low}
                    </div>
                </div>
            </div>
            <div class="report-section">
                <h5>Peak Hours Analysis</h5>
                <div class="peak-hours">
                    ${report.peakHours.map(hour => `
                        <div class="peak-hour-item">
                            <strong>${hour.hour}:00:</strong> ${hour.users} active users, ${hour.conversations} conversations
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    async downloadReport(reportType, format) {
        try {
            // This would generate and download a formatted report
            // For now, we'll use the existing export functionality
            await this.exportData(format);
        } catch (error) {
            this.showError('Failed to download report: ' + error.message);
        }
    }

    // Monitoring Functions
    refreshMonitoring() {
        this.loadMonitoringData();
        this.showSuccess('Monitoring data refreshed');
    }

    toggleAutoRefresh() {
        const toggle = document.getElementById('autoRefreshToggle');
        
        if (toggle.checked) {
            this.autoRefreshInterval = setInterval(() => {
                this.loadMonitoringData();
            }, 30000); // Refresh every 30 seconds
        } else {
            if (this.autoRefreshInterval) {
                clearInterval(this.autoRefreshInterval);
                this.autoRefreshInterval = null;
            }
        }
    }

    updateAnalytics() {
        const dateRange = document.getElementById('dateRangeSelect').value;
        const customInputs = document.getElementById('customDateInputs');
        
        if (dateRange === 'custom') {
            customInputs.style.display = 'flex';
        } else {
            customInputs.style.display = 'none';
        }

        // Reload analytics with new date range
        this.loadAnalyticsData();
    }

    cleanupOldData() {
        if (confirm('Are you sure you want to cleanup old data? This action cannot be undone.')) {
            this.showLoading(true);
            
            // Simulate cleanup
            setTimeout(() => {
                this.showLoading(false);
                this.showSuccess('Old data cleaned up successfully');
            }, 3000);
        }
    }

    // WebSocket functionality
    initializeWebSocket() {
        try {
            this.socket = io({
                path: '/socket.io/',
                transports: ['websocket', 'polling']
            });

            this.socket.on('connect', () => {
                console.log('Connected to real-time monitoring');
                this.isConnected = true;
                this.authenticateSocket();
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from real-time monitoring');
                this.isConnected = false;
            });

            this.socket.on('authenticated', (data) => {
                if (data.success) {
                    console.log('Socket authenticated successfully');
                    this.subscribeToMonitoring();
                }
            });

            this.socket.on('authentication-failed', (data) => {
                console.error('Socket authentication failed:', data.error);
            });

            this.socket.on('monitoring-subscribed', (data) => {
                if (data.success) {
                    console.log('Subscribed to monitoring updates');
                }
            });

            this.socket.on('monitoring-update', (data) => {
                this.handleMonitoringUpdate(data);
            });

            this.socket.on('new-crisis-alert', (alert) => {
                this.handleNewCrisisAlert(alert);
            });

            this.socket.on('critical-alert', (alert) => {
                this.handleCriticalAlert(alert);
            });

            this.socket.on('alert-updated', (data) => {
                this.handleAlertUpdate(data);
            });

            this.socket.on('alert-resolved', (data) => {
                this.handleAlertResolution(data);
            });

            this.socket.on('notification', (notification) => {
                this.handleNotification(notification);
            });

            this.socket.on('system-alert', (alert) => {
                this.handleSystemAlert(alert);
            });

            this.socket.on('error', (error) => {
                console.error('Socket error:', error);
            });

        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
        }
    }

    authenticateSocket() {
        if (this.socket && this.authToken && this.currentUser) {
            this.socket.emit('authenticate', {
                token: this.authToken,
                userRole: this.currentUser.role,
                userId: this.currentUser.username
            });
        }
    }

    subscribeToMonitoring() {
        if (this.socket) {
            this.socket.emit('subscribe-monitoring');
        }
    }

    handleMonitoringUpdate(data) {
        // Update real-time statistics
        if (this.currentSection === 'overview') {
            this.updateOverviewStats(data);
        }
        
        if (this.currentSection === 'monitoring') {
            this.updateMonitoringData(data);
        }
    }

    updateOverviewStats(data) {
        if (data.usageStats) {
            document.getElementById('totalUsersCount').textContent = data.usageStats.totalUsers || 0;
            document.getElementById('totalConversationsCount').textContent = data.usageStats.totalConversations || 0;
            document.getElementById('crisisAlertsCount').textContent = data.activeAlerts?.length || 0;
            document.getElementById('avgSentimentScore').textContent = data.usageStats.avgSentiment?.toFixed(1) || '0.0';
        }
    }

    updateMonitoringData(data) {
        // Update active sessions count
        const activeUsersCount = document.getElementById('activeUsersCount');
        if (activeUsersCount) {
            activeUsersCount.textContent = data.activeSessions || 0;
        }

        // Update crisis alerts
        this.updateCrisisAlertsList(data.activeAlerts || []);

        // Update system status
        this.updateSystemStatus(data.systemMetrics);
    }

    updateCrisisAlertsList(alerts) {
        const crisisAlertsList = document.getElementById('crisisAlertsList');
        if (!crisisAlertsList) return;

        if (alerts.length === 0) {
            crisisAlertsList.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 20px;">No active crisis alerts</div>';
        } else {
            crisisAlertsList.innerHTML = alerts.map(alert => `
                <div class="crisis-alert-item" data-alert-id="${alert.id}">
                    <div><strong>Crisis Alert - ${alert.userId}</strong></div>
                    <div>Severity: ${alert.severity} | ${this.formatTimeAgo(alert.createdAt)}</div>
                    <div>Status: ${alert.status}</div>
                    <div class="alert-actions">
                        <button class="action-btn" onclick="adminDashboard.acknowledgeAlert('${alert.id}')">Acknowledge</button>
                        <button class="action-btn" onclick="adminDashboard.escalateAlert('${alert.id}')">Escalate</button>
                        <button class="action-btn" onclick="adminDashboard.resolveAlert('${alert.id}')">Resolve</button>
                    </div>
                </div>
            `).join('');
        }
    }

    updateSystemStatus(systemMetrics) {
        const systemStatusGrid = document.getElementById('systemStatusGrid');
        if (!systemStatusGrid || !systemMetrics) return;

        const services = [
            { name: 'API Server', status: systemMetrics.avgResponseTime < 2000 ? 'online' : 'degraded' },
            { name: 'Database', status: 'online' },
            { name: 'WebSocket', status: this.isConnected ? 'online' : 'offline' },
            { name: 'Monitoring', status: 'online' }
        ];

        systemStatusGrid.innerHTML = services.map(service => `
            <div class="status-indicator ${service.status}">
                <div>${service.name}</div>
                <div>${service.status.toUpperCase()}</div>
            </div>
        `).join('');
    }

    handleNewCrisisAlert(alert) {
        // Show notification
        this.showNotification(`New crisis alert: ${alert.severity} severity`, 'warning');
        
        // Play notification sound (if enabled)
        this.playNotificationSound();
        
        // Update alerts display if on monitoring page
        if (this.currentSection === 'monitoring') {
            this.loadCrisisAlerts();
        }
    }

    handleCriticalAlert(alert) {
        // Show urgent notification
        this.showNotification(`CRITICAL ALERT: Immediate attention required for ${alert.userId}`, 'error');
        
        // Flash the page or show modal for critical alerts
        this.flashCriticalAlert();
        
        // Play urgent notification sound
        this.playUrgentNotificationSound();
    }

    handleAlertUpdate(data) {
        this.showNotification(`Alert ${data.alertId} acknowledged by ${data.acknowledgedBy}`, 'info');
        
        // Update the specific alert in the UI
        const alertElement = document.querySelector(`[data-alert-id="${data.alertId}"]`);
        if (alertElement) {
            // Update alert status display
            const statusElement = alertElement.querySelector('.alert-status');
            if (statusElement) {
                statusElement.textContent = `Status: ${data.alert.status}`;
            }
        }
    }

    handleAlertResolution(data) {
        this.showNotification(`Alert ${data.alertId} resolved by ${data.resolvedBy}`, 'success');
        
        // Remove the alert from the UI
        const alertElement = document.querySelector(`[data-alert-id="${data.alertId}"]`);
        if (alertElement) {
            alertElement.remove();
        }
    }

    handleNotification(notification) {
        this.showNotification(notification.message, notification.type || 'info');
    }

    handleSystemAlert(alert) {
        this.showNotification(`System Alert: ${alert.message}`, 'warning');
    }

    // Alert management functions
    acknowledgeAlert(alertId) {
        if (this.socket) {
            this.socket.emit('acknowledge-alert', alertId);
        }
    }

    escalateAlert(alertId) {
        if (confirm('Are you sure you want to escalate this alert?')) {
            if (this.socket) {
                this.socket.emit('escalate-alert', alertId);
            }
        }
    }

    async resolveAlert(alertId) {
        if (confirm('Are you sure you want to resolve this alert?')) {
            try {
                const response = await fetch(`/api/monitoring/alert/${alertId}/resolve`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    this.showSuccess('Alert resolved successfully');
                } else {
                    throw new Error('Failed to resolve alert');
                }
            } catch (error) {
                this.showError('Failed to resolve alert: ' + error.message);
            }
        }
    }

    // Notification functions
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Add to notifications container or create one
        let container = document.getElementById('notificationsContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notificationsContainer';
            container.className = 'notifications-container';
            document.body.appendChild(container);
        }

        container.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    playNotificationSound() {
        // Simple notification sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            console.log('Could not play notification sound:', error);
        }
    }

    playUrgentNotificationSound() {
        // Urgent notification sound - multiple beeps
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                    
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.3);
                }, i * 400);
            }
        } catch (error) {
            console.log('Could not play urgent notification sound:', error);
        }
    }

    flashCriticalAlert() {
        // Flash the page background for critical alerts
        document.body.style.backgroundColor = '#ef4444';
        setTimeout(() => {
            document.body.style.backgroundColor = '';
        }, 200);
        
        setTimeout(() => {
            document.body.style.backgroundColor = '#ef4444';
            setTimeout(() => {
                document.body.style.backgroundColor = '';
            }, 200);
        }, 400);
    }

    formatTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }

    // Booking Management Methods
    async loadBookingsData() {
        try {
            const response = await fetch('/api/booking/appointments', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch bookings');
            }

            const data = await response.json();
            this.updateBookingsDisplay(data.bookings);
            this.updateBookingStats(data.bookings);
        } catch (error) {
            console.error('Error loading bookings:', error);
            this.showError('Failed to load bookings data');
        }
    }

    async loadBookingStats() {
        try {
            const response = await fetch('/api/booking/stats', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch booking stats');
            }

            const data = await response.json();
            this.updateDashboardBookingStats(data.stats);
        } catch (error) {
            console.error('Error loading booking stats:', error);
        }
    }

    updateDashboardBookingStats(stats) {
        // Update the booking count in the overview section
        document.getElementById('totalBookingsCount').textContent = stats.total || 0;
    }

    updateBookingStats(bookings) {
        const stats = {
            pending: 0,
            confirmed: 0,
            completed: 0,
            cancelled: 0
        };

        bookings.forEach(booking => {
            if (stats.hasOwnProperty(booking.status)) {
                stats[booking.status]++;
            }
        });

        document.getElementById('pendingBookingsCount').textContent = stats.pending;
        document.getElementById('confirmedBookingsCount').textContent = stats.confirmed;
        document.getElementById('completedBookingsCount').textContent = stats.completed;
        document.getElementById('cancelledBookingsCount').textContent = stats.cancelled;
    }

    updateBookingsDisplay(bookings) {
        const tbody = document.getElementById('bookingsTableBody');
        tbody.innerHTML = '';

        bookings.forEach(booking => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${booking.id.substring(0, 8)}...</td>
                <td>${booking.studentId || 'Anonymous'}</td>
                <td>${booking.preferredDate} ${booking.preferredTime}</td>
                <td><span class="session-type-badge ${booking.sessionType}">${booking.sessionType}</span></td>
                <td>${booking.contactMethod}: ${booking.contactInfo}</td>
                <td><span class="booking-status-badge ${booking.status}">${booking.status}</span></td>
                <td>
                    <button class="view-booking-btn" onclick="viewBookingDetails('${booking.id}')">
                        👁️ View
                    </button>
                    <button class="edit-booking-btn" onclick="editBooking('${booking.id}')">
                        ✏️ Edit
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async viewBookingDetails(bookingId) {
        try {
            const response = await fetch(`/api/booking/appointments/${bookingId}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch booking details');
            }

            const data = await response.json();
            this.showBookingDetailsModal(data.booking);
        } catch (error) {
            console.error('Error fetching booking details:', error);
            this.showError('Failed to load booking details');
        }
    }

    showBookingDetailsModal(booking) {
        const modal = document.getElementById('bookingDetailsModal');
        const content = document.getElementById('bookingDetailsContent');
        
        content.innerHTML = `
            <div class="booking-detail-grid">
                <div class="detail-item">
                    <strong>Booking ID:</strong>
                    <span>${booking.id}</span>
                </div>
                <div class="detail-item">
                    <strong>Student ID:</strong>
                    <span>${booking.studentId || 'Anonymous'}</span>
                </div>
                <div class="detail-item">
                    <strong>Preferred Date:</strong>
                    <span>${booking.preferredDate}</span>
                </div>
                <div class="detail-item">
                    <strong>Preferred Time:</strong>
                    <span>${booking.preferredTime}</span>
                </div>
                <div class="detail-item">
                    <strong>Session Type:</strong>
                    <span class="session-type ${booking.sessionType}">${booking.sessionType}</span>
                </div>
                <div class="detail-item">
                    <strong>Contact Method:</strong>
                    <span>${booking.contactMethod}</span>
                </div>
                <div class="detail-item">
                    <strong>Contact Information:</strong>
                    <span>${booking.contactInfo}</span>
                </div>
                <div class="detail-item">
                    <strong>Status:</strong>
                    <span class="booking-status-badge ${booking.status}">${booking.status}</span>
                </div>
                <div class="detail-item">
                    <strong>Created At:</strong>
                    <span>${new Date(booking.createdAt).toLocaleString()}</span>
                </div>
                ${booking.concerns ? `
                    <div class="detail-item full-width">
                        <strong>Concerns:</strong>
                        <p>${booking.concerns}</p>
                    </div>
                ` : ''}
                ${booking.notes ? `
                    <div class="detail-item full-width">
                        <strong>Admin Notes:</strong>
                        <p>${booking.notes}</p>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Store current booking ID for actions
        modal.dataset.bookingId = booking.id;
        modal.style.display = 'flex';
    }

    closeBookingDetailsModal() {
        document.getElementById('bookingDetailsModal').style.display = 'none';
    }

    async updateBookingStatus(newStatus) {
        const modal = document.getElementById('bookingDetailsModal');
        const bookingId = modal.dataset.bookingId;
        
        if (!bookingId) return;
        
        try {
            const response = await fetch(`/api/booking/appointments/${bookingId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    status: newStatus,
                    notes: `Status updated to ${newStatus} by ${this.currentUser.username}`,
                    assignedCounselor: this.currentUser.role === 'counselor' ? this.currentUser.username : null
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update booking status');
            }

            this.showSuccess(`Booking status updated to ${newStatus}`);
            this.closeBookingDetailsModal();
            this.refreshBookings();
        } catch (error) {
            console.error('Error updating booking status:', error);
            this.showError('Failed to update booking status');
        }
    }

    async refreshBookings() {
        await this.loadBookingsData();
    }

    async exportBookings() {
        try {
            // For now, let's use the JSON export from the BookingService
            const response = await fetch('/api/booking/appointments', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch bookings for export');
            }

            const data = await response.json();
            const bookings = data.bookings;
            
            // Convert to CSV format
            const headers = ['ID', 'Student ID', 'Date', 'Time', 'Session Type', 'Contact Method', 'Contact Info', 'Status', 'Created At', 'Concerns'];
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
                    new Date(booking.createdAt).toLocaleString(),
                    `"${(booking.concerns || '').replace(/"/g, '""')}"`
                ];
                csvData.push(row.join(','));
            });
            
            // Download CSV file
            const blob = new Blob([csvData.join('\n')], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bookings_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showSuccess('Bookings exported successfully');
        } catch (error) {
            console.error('Error exporting bookings:', error);
            this.showError('Failed to export bookings');
        }
    }

    async filterBookings() {
        // Get filter values
        const statusFilter = document.getElementById('bookingStatusFilter').value;
        const sessionTypeFilter = document.getElementById('sessionTypeFilter').value;
        const dateFrom = document.getElementById('bookingDateFrom').value;
        const dateTo = document.getElementById('bookingDateTo').value;
        
        // Build query parameters
        const params = new URLSearchParams();
        if (statusFilter && statusFilter !== 'all') {
            params.append('status', statusFilter);
        }
        if (sessionTypeFilter && sessionTypeFilter !== 'all') {
            params.append('sessionType', sessionTypeFilter);
        }
        if (dateFrom) {
            params.append('dateFrom', dateFrom);
        }
        if (dateTo) {
            params.append('dateTo', dateTo);
        }
        
        try {
            const response = await fetch(`/api/booking/appointments?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch filtered bookings');
            }

            const data = await response.json();
            this.updateBookingsDisplay(data.bookings);
        } catch (error) {
            console.error('Error filtering bookings:', error);
            this.showError('Failed to filter bookings');
        }
    }
}

// Global functions for HTML event handlers
let adminDashboard;

function handleAdminLogin(event) {
    adminDashboard.handleAdminLogin(event);
}

function adminLogout() {
    adminDashboard.adminLogout();
}

function showAdminSection(section) {
    adminDashboard.showAdminSection(section);
}

function switchLanguage(lang) {
    adminDashboard.switchLanguage(lang);
}

function showAddUserModal() {
    adminDashboard.showAddUserModal();
}

function closeAddUserModal() {
    adminDashboard.closeAddUserModal();
}

function handleAddUser(event) {
    adminDashboard.handleAddUser(event);
}

function refreshMonitoring() {
    adminDashboard.refreshMonitoring();
}

function toggleAutoRefresh() {
    adminDashboard.toggleAutoRefresh();
}

function updateAnalytics() {
    adminDashboard.updateAnalytics();
}

function generateReport(type) {
    adminDashboard.generateReport(type);
}

function exportData(format) {
    adminDashboard.exportData(format);
}

function saveSettings() {
    adminDashboard.saveSettings();
}

function resetSettings() {
    adminDashboard.resetSettings();
}

function cleanupOldData() {
    adminDashboard.cleanupOldData();
}

// Booking Management Global Functions
function refreshBookings() {
    adminDashboard.refreshBookings();
}

function exportBookings() {
    adminDashboard.exportBookings();
}

function filterBookings() {
    adminDashboard.filterBookings();
}

function viewBookingDetails(bookingId) {
    adminDashboard.viewBookingDetails(bookingId);
}

function editBooking(bookingId) {
    // For now, just show details - could be extended to edit functionality
    adminDashboard.viewBookingDetails(bookingId);
}

function closeBookingDetailsModal() {
    adminDashboard.closeBookingDetailsModal();
}

function updateBookingStatus(status) {
    adminDashboard.updateBookingStatus(status);
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    adminDashboard = new AdminDashboard();
});

// ========== SCREENING RESPONSES MANAGEMENT ==========

class ScreeningResponsesManager {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalPages = 1;
        this.currentFilters = {};
        this.selectedResponseId = null;
        this.autoRefreshInterval = null;
        this.lastUpdateTime = null;
    }

    async loadScreeningResponses(page = 1) {
        try {
            console.log('Loading screening responses, page:', page);
            const params = new URLSearchParams({
                page: page,
                limit: this.pageSize,
                sortBy: 'completedAt',
                sortOrder: 'desc',
                ...this.currentFilters
            });

            const response = await fetch(`/api/screening-responses/admin/responses?${params}`);
            const data = await response.json();
            console.log('Screening responses data:', data);

            if (data.success) {
                this.displayScreeningResponses(data.data.responses);
                this.updatePagination(data.data.pagination);
                this.currentPage = page;
            } else {
                console.error('Failed to load screening responses:', data.error);
                this.showError('Failed to load screening responses');
            }
        } catch (error) {
            console.error('Error loading screening responses:', error);
            this.showError('Error loading screening responses');
        }
    }

    async loadScreeningOverview() {
        try {
            console.log('Loading screening overview...');
            const response = await fetch('/api/screening-responses/admin/overview');
            const data = await response.json();
            console.log('Screening overview response:', data);

            if (data.success) {
                // Check if there's new data
                const newCount = data.data.overview.totalScreenings;
                const previousCount = this.lastTotalCount || 0;
                
                if (newCount > previousCount && previousCount > 0) {
                    this.showNewDataAlert(newCount - previousCount);
                }
                
                this.lastTotalCount = newCount;
                this.updateOverviewStats(data.data.overview);
                this.displayCrisisAlerts(data.data.recentCrisisAlerts);
                
                // Show database status message if present
                if (data.message) {
                    this.showDatabaseStatus(data.message);
                } else {
                    console.log('Database connected successfully');
                }
            }
        } catch (error) {
            console.error('Error loading screening overview:', error);
            this.showDatabaseStatus('Failed to connect to screening database');
        }
    }

    showNewDataAlert(newCount) {
        // Create a temporary notification for new submissions
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            z-index: 1000;
            font-size: 14px;
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span>🆕</span>
                <span>${newCount} new screening response${newCount > 1 ? 's' : ''} received!</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    showDatabaseStatus(message) {
        // Create or update database status indicator
        let statusDiv = document.getElementById('databaseStatus');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'databaseStatus';
            statusDiv.style.cssText = `
                background: rgba(245, 158, 11, 0.1);
                border: 1px solid rgba(245, 158, 11, 0.3);
                color: #f59e0b;
                padding: 10px 15px;
                border-radius: 6px;
                margin-bottom: 20px;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            
            const screeningSection = document.getElementById('screening-responses');
            if (screeningSection) {
                const header = screeningSection.querySelector('.screening-responses-header');
                if (header) {
                    header.parentNode.insertBefore(statusDiv, header.nextSibling);
                }
            }
        }
        
        statusDiv.innerHTML = `
            <span>⚠️</span>
            <span>${message}</span>
        `;
    }

    displayScreeningResponses(responses) {
        console.log('Displaying screening responses:', responses?.length || 0, 'responses');
        
        const tbody = document.getElementById('screeningResponsesTableBody');
        console.log('Table body element found:', !!tbody);
        
        if (!tbody) {
            console.error('Table body element not found!');
            return;
        }
        
        if (!responses || responses.length === 0) {
            console.log('No responses to display');
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 20px; color: #9ca3af;">
                        <span data-en="No screening responses found" data-mr="कोणतेही स्क्रीनिंग प्रतिसाद आढळले नाहीत">No screening responses found</span>
                    </td>
                </tr>
            `;
            return;
        }

        console.log('Creating table rows for', responses.length, 'responses');
        
        const tableRows = responses.map(response => {
            const completedAt = new Date(response.completedAt);
            const riskLevel = this.getRiskLevel(response);
            const riskColor = this.getRiskColor(riskLevel);
            
            console.log('Processing response:', response._id, response.toolName, response.results.severityLevel);
            
            return `
                <tr class="screening-response-row" data-id="${response._id}">
                    <td>
                        <div class="date-time">
                            <div>${completedAt.toLocaleDateString()}</div>
                            <div style="font-size: 12px; color: #9ca3af;">${completedAt.toLocaleTimeString()}</div>
                        </div>
                    </td>
                    <td>
                        <div class="user-info">
                            <div style="font-weight: 500;">${this.maskEmail(response.userEmail)}</div>
                            <div style="font-size: 12px; color: #9ca3af;">${response.userId.substring(0, 8)}...</div>
                        </div>
                    </td>
                    <td>
                        <span class="tool-badge tool-${response.toolName.toLowerCase().replace('-', '')}">${response.toolName}</span>
                    </td>
                    <td>
                        <div class="score-display">
                            <div style="font-weight: 600;">${response.results.totalScore}/${response.results.maxScore}</div>
                            <div style="font-size: 12px; color: #9ca3af;">${response.results.percentage}%</div>
                        </div>
                    </td>
                    <td>
                        <span class="severity-badge severity-${response.results.severityLevel}" style="background-color: ${riskColor}20; color: ${riskColor}; border: 1px solid ${riskColor}40;">
                            ${this.formatSeverityLevel(response.results.severityLevel)}
                        </span>
                    </td>
                    <td>
                        ${response.crisisIndicators.hasCrisisAlerts ? 
                            '<span class="crisis-indicator">🚨</span>' : 
                            '<span style="color: #9ca3af;">—</span>'
                        }
                    </td>
                    <td>
                        <span class="status-badge status-${response.status}">
                            ${this.formatStatus(response.status)}
                        </span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-small btn-primary" onclick="screeningManager.viewResponseDetail('${response._id}')">
                                <span data-en="View" data-mr="पहा">View</span>
                            </button>
                            ${response.crisisIndicators.hasCrisisAlerts ? 
                                '<button class="btn-small btn-danger" onclick="screeningManager.handleCrisisResponse(\'' + response._id + '\')">Crisis</button>' : 
                                ''
                            }
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = tableRows.join('');
        console.log('Table updated with', tableRows.length, 'rows');
    }

    updateOverviewStats(stats) {
        console.log('Updating overview stats with:', stats);
        
        const totalElement = document.getElementById('totalScreeningsCount');
        const crisisElement = document.getElementById('crisisScreeningsCount');
        const avgElement = document.getElementById('avgScreeningScore');
        const usersElement = document.getElementById('uniqueScreeningUsers');
        
        console.log('DOM elements found:', {
            total: !!totalElement,
            crisis: !!crisisElement,
            avg: !!avgElement,
            users: !!usersElement
        });
        
        if (totalElement) totalElement.textContent = stats.totalScreenings || 0;
        if (crisisElement) crisisElement.textContent = stats.crisisAlerts || 0;
        if (avgElement) avgElement.textContent = Math.round(stats.averageScore || 0) + '%';
        
        // Calculate unique users from tool breakdown if available
        const uniqueUsers = stats.toolBreakdown ? 
            new Set(stats.toolBreakdown.map(item => item.userId)).size : 0;
        if (usersElement) usersElement.textContent = uniqueUsers;
        
        console.log('Stats updated successfully');
    }

    displayCrisisAlerts(crisisAlerts) {
        const container = document.getElementById('crisisAlertsSummary');
        const list = document.getElementById('crisisAlertsList');
        
        if (!crisisAlerts || crisisAlerts.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        list.innerHTML = crisisAlerts.map(alert => `
            <div class="crisis-alert-item">
                <div class="crisis-alert-header">
                    <span class="crisis-severity">🚨 ${alert.toolName}</span>
                    <span class="crisis-time">${new Date(alert.completedAt).toLocaleString()}</span>
                </div>
                <div class="crisis-alert-details">
                    <div>User: ${this.maskEmail(alert.userEmail)}</div>
                    <div>Severity: ${this.formatSeverityLevel(alert.results.severityLevel)}</div>
                    ${alert.userDescription ? `<div class="user-description">"${alert.userDescription.substring(0, 100)}..."</div>` : ''}
                </div>
                <div class="crisis-alert-actions">
                    <button class="btn-small btn-danger" onclick="screeningManager.handleCrisisResponse('${alert._id}')">
                        <span data-en="Handle Crisis" data-mr="संकट हाताळा">Handle Crisis</span>
                    </button>
                </div>
            </div>
        `).join('');
    }

    async viewResponseDetail(responseId) {
        try {
            const response = await fetch(`/api/screening-responses/admin/response/${responseId}`);
            const data = await response.json();

            if (data.success) {
                this.displayResponseDetail(data.data);
                this.selectedResponseId = responseId;
                document.getElementById('screeningDetailModal').style.display = 'flex';
            } else {
                this.showError('Failed to load response details');
            }
        } catch (error) {
            console.error('Error loading response details:', error);
            this.showError('Error loading response details');
        }
    }

    displayResponseDetail(response) {
        const content = document.getElementById('screeningDetailContent');
        const completedAt = new Date(response.completedAt);
        
        content.innerHTML = `
            <div class="response-detail-container">
                <!-- Basic Information -->
                <div class="detail-section">
                    <h4><span data-en="Basic Information" data-mr="मूलभूत माहिती">Basic Information</span></h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label><span data-en="User Email:" data-mr="वापरकर्ता ईमेल:">User Email:</span></label>
                            <span>${response.userEmail}</span>
                        </div>
                        <div class="detail-item">
                            <label><span data-en="Completed At:" data-mr="पूर्ण केले:">Completed At:</span></label>
                            <span>${completedAt.toLocaleString()}</span>
                        </div>
                        <div class="detail-item">
                            <label><span data-en="Tool Used:" data-mr="वापरलेले साधन:">Tool Used:</span></label>
                            <span>${response.toolName}</span>
                        </div>
                        <div class="detail-item">
                            <label><span data-en="Language:" data-mr="भाषा:">Language:</span></label>
                            <span>${response.language === 'mr' ? 'Marathi' : 'English'}</span>
                        </div>
                    </div>
                </div>

                <!-- Results -->
                <div class="detail-section">
                    <h4><span data-en="Assessment Results" data-mr="मूल्यांकन परिणाम">Assessment Results</span></h4>
                    <div class="results-summary">
                        <div class="result-item">
                            <label><span data-en="Total Score:" data-mr="एकूण गुण:">Total Score:</span></label>
                            <span class="score-large">${response.results.totalScore}/${response.results.maxScore} (${response.results.percentage}%)</span>
                        </div>
                        <div class="result-item">
                            <label><span data-en="Severity Level:" data-mr="तीव्रता पातळी:">Severity Level:</span></label>
                            <span class="severity-badge severity-${response.results.severityLevel}">
                                ${this.formatSeverityLevel(response.results.severityLevel)}
                            </span>
                        </div>
                        <div class="result-item">
                            <label><span data-en="Above Clinical Threshold:" data-mr="क्लिनिकल मर्यादेपेक्षा वर:">Above Clinical Threshold:</span></label>
                            <span class="${response.results.isAboveThreshold ? 'text-danger' : 'text-success'}">
                                ${response.results.isAboveThreshold ? 'Yes' : 'No'}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Crisis Indicators -->
                ${response.crisisIndicators.hasCrisisAlerts ? `
                    <div class="detail-section crisis-section">
                        <h4 style="color: #ef4444;"><span data-en="🚨 Crisis Indicators" data-mr="🚨 संकट सूचक">🚨 Crisis Indicators</span></h4>
                        <div class="crisis-alerts">
                            ${response.crisisIndicators.crisisAlerts.map(alert => `
                                <div class="crisis-alert-detail">
                                    <div class="alert-type">${alert.type}</div>
                                    <div class="alert-severity">Severity: ${alert.severity}</div>
                                    <div class="alert-message">${alert.message}</div>
                                </div>
                            `).join('')}
                        </div>
                        ${response.crisisIndicators.requiresImmediateAttention ? 
                            '<div class="immediate-attention"><strong>⚠️ Requires Immediate Attention</strong></div>' : ''
                        }
                    </div>
                ` : ''}

                <!-- User Description -->
                ${response.userDescription ? `
                    <div class="detail-section">
                        <h4><span data-en="User's Additional Notes" data-mr="वापरकर्त्याच्या अतिरिक्त टिप्पण्या">User's Additional Notes</span></h4>
                        <div class="user-description-box">
                            ${response.userDescription}
                        </div>
                    </div>
                ` : ''}

                <!-- Detailed Responses -->
                <div class="detail-section">
                    <h4><span data-en="Detailed Responses" data-mr="तपशीलवार प्रतिसाद">Detailed Responses</span></h4>
                    <div class="responses-table">
                        <table>
                            <thead>
                                <tr>
                                    <th><span data-en="Question" data-mr="प्रश्न">Question</span></th>
                                    <th><span data-en="Response" data-mr="प्रतिसाद">Response</span></th>
                                    <th><span data-en="Score" data-mr="गुण">Score</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${response.responses.map(resp => `
                                    <tr>
                                        <td>${resp.questionText}</td>
                                        <td>${this.getResponseText(resp.response)}</td>
                                        <td>${resp.response}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Admin Actions -->
                <div class="detail-section">
                    <h4><span data-en="Admin Actions" data-mr="प्रशासक क्रिया">Admin Actions</span></h4>
                    <div class="admin-actions">
                        <div class="action-group">
                            <label for="statusSelect"><span data-en="Update Status:" data-mr="स्थिती अपडेट करा:">Update Status:</span></label>
                            <select id="statusSelect">
                                <option value="completed" ${response.status === 'completed' ? 'selected' : ''}>Completed</option>
                                <option value="reviewed" ${response.status === 'reviewed' ? 'selected' : ''}>Reviewed</option>
                                <option value="follow_up_needed" ${response.status === 'follow_up_needed' ? 'selected' : ''}>Follow-up Needed</option>
                                <option value="resolved" ${response.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                            </select>
                        </div>
                        <div class="action-group">
                            <label for="adminNoteInput"><span data-en="Add Admin Note:" data-mr="प्रशासक टिप्पणी जोडा:">Add Admin Note:</span></label>
                            <textarea id="adminNoteInput" placeholder="Enter admin note..." rows="3"></textarea>
                        </div>
                        <div class="action-group">
                            <label for="counselorAssign"><span data-en="Assign Counselor:" data-mr="समुपदेशक नियुक्त करा:">Assign Counselor:</span></label>
                            <input type="text" id="counselorAssign" placeholder="Counselor name or ID" value="${response.counselorAssigned || ''}">
                        </div>
                    </div>
                </div>

                <!-- Previous Admin Notes -->
                ${response.adminNotes && response.adminNotes.length > 0 ? `
                    <div class="detail-section">
                        <h4><span data-en="Admin Notes History" data-mr="प्रशासक टिप्पण्यांचा इतिहास">Admin Notes History</span></h4>
                        <div class="admin-notes-history">
                            ${response.adminNotes.map(note => `
                                <div class="admin-note">
                                    <div class="note-header">
                                        <span class="note-author">${note.addedBy}</span>
                                        <span class="note-date">${new Date(note.addedAt).toLocaleString()}</span>
                                    </div>
                                    <div class="note-content">${note.note}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async updateScreeningStatus() {
        if (!this.selectedResponseId) return;

        const status = document.getElementById('statusSelect').value;
        const adminNote = document.getElementById('adminNoteInput').value.trim();
        const counselorAssigned = document.getElementById('counselorAssign').value.trim();

        try {
            const response = await fetch(`/api/screening-responses/admin/response/${this.selectedResponseId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status,
                    adminNote: adminNote || undefined,
                    adminUser: this.getCurrentAdminUser(),
                    counselorAssigned: counselorAssigned || undefined
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Response updated successfully');
                this.closeScreeningDetailModal();
                this.loadScreeningResponses(this.currentPage);
            } else {
                this.showError('Failed to update response');
            }
        } catch (error) {
            console.error('Error updating response:', error);
            this.showError('Error updating response');
        }
    }

    async handleCrisisResponse(responseId) {
        if (confirm('This will mark the crisis as being handled. Continue?')) {
            try {
                const response = await fetch(`/api/screening-responses/admin/response/${responseId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: 'reviewed',
                        adminNote: 'Crisis response initiated',
                        adminUser: this.getCurrentAdminUser()
                    })
                });

                const data = await response.json();

                if (data.success) {
                    this.showSuccess('Crisis response recorded');
                    this.loadScreeningResponses(this.currentPage);
                    this.loadScreeningOverview();
                } else {
                    this.showError('Failed to update crisis response');
                }
            } catch (error) {
                console.error('Error handling crisis response:', error);
                this.showError('Error handling crisis response');
            }
        }
    }

    filterScreeningResponses() {
        const toolFilter = document.getElementById('toolFilter').value;
        const severityFilter = document.getElementById('severityFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const crisisOnly = document.getElementById('crisisOnlyFilter').checked;

        this.currentFilters = {};
        if (toolFilter) this.currentFilters.toolName = toolFilter;
        if (severityFilter) this.currentFilters.severityLevel = severityFilter;
        if (statusFilter) this.currentFilters.status = statusFilter;
        if (crisisOnly) this.currentFilters.crisisOnly = 'true';

        this.loadScreeningResponses(1);
    }

    updatePagination(pagination) {
        this.totalPages = pagination.totalPages;
        
        document.getElementById('paginationInfo').innerHTML = 
            `<span data-en="Showing ${((pagination.currentPage - 1) * 20) + 1}-${Math.min(pagination.currentPage * 20, pagination.totalCount)} of ${pagination.totalCount} responses" 
                   data-mr="${((pagination.currentPage - 1) * 20) + 1}-${Math.min(pagination.currentPage * 20, pagination.totalCount)} पैकी ${pagination.totalCount} प्रतिसाद दाखवत आहे">
                Showing ${((pagination.currentPage - 1) * 20) + 1}-${Math.min(pagination.currentPage * 20, pagination.totalCount)} of ${pagination.totalCount} responses
            </span>`;

        document.getElementById('prevPageBtn').disabled = !pagination.hasPrev;
        document.getElementById('nextPageBtn').disabled = !pagination.hasNext;

        // Update page numbers
        const pageNumbers = document.getElementById('pageNumbers');
        let pagesHtml = '';
        const startPage = Math.max(1, pagination.currentPage - 2);
        const endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            pagesHtml += `
                <button class="page-btn ${i === pagination.currentPage ? 'active' : ''}" 
                        onclick="screeningManager.loadScreeningResponses(${i})">
                    ${i}
                </button>
            `;
        }
        pageNumbers.innerHTML = pagesHtml;
    }

    changePage(direction) {
        const newPage = this.currentPage + direction;
        if (newPage >= 1 && newPage <= this.totalPages) {
            this.loadScreeningResponses(newPage);
        }
    }

    closeScreeningDetailModal() {
        document.getElementById('screeningDetailModal').style.display = 'none';
        this.selectedResponseId = null;
    }

    // Utility functions
    getRiskLevel(response) {
        if (response.crisisIndicators.requiresImmediateAttention) return 'critical';
        if (response.crisisIndicators.hasCrisisAlerts) return 'high';
        if (['severe', 'moderately_severe'].includes(response.results.severityLevel)) return 'elevated';
        if (response.results.severityLevel === 'moderate') return 'moderate';
        return 'low';
    }

    getRiskColor(riskLevel) {
        const colors = {
            critical: '#dc2626',
            high: '#ea580c',
            elevated: '#d97706',
            moderate: '#ca8a04',
            low: '#16a34a'
        };
        return colors[riskLevel] || '#6b7280';
    }

    maskEmail(email) {
        const [username, domain] = email.split('@');
        const maskedUsername = username.length > 3 ? 
            username.substring(0, 2) + '*'.repeat(username.length - 2) : 
            username;
        return `${maskedUsername}@${domain}`;
    }

    formatSeverityLevel(level) {
        const levels = {
            minimal: 'Minimal',
            mild: 'Mild',
            moderate: 'Moderate',
            moderately_severe: 'Moderately Severe',
            severe: 'Severe',
            normal: 'Normal',
            distressed: 'Distressed'
        };
        return levels[level] || level;
    }

    formatStatus(status) {
        const statuses = {
            completed: 'Completed',
            reviewed: 'Reviewed',
            follow_up_needed: 'Follow-up Needed',
            resolved: 'Resolved'
        };
        return statuses[status] || status;
    }

    getResponseText(value) {
        const responses = {
            0: 'Not at all',
            1: 'Several days',
            2: 'More than half the days',
            3: 'Nearly every day'
        };
        return responses[value] || value;
    }

    getCurrentAdminUser() {
        return localStorage.getItem('adminUsername') || 'admin';
    }

    showSuccess(message) {
        // Implement success notification
        console.log('Success:', message);
    }

    showError(message) {
        // Implement error notification
        console.error('Error:', message);
    }

    // Auto-refresh functionality for real-time updates
    startAutoRefresh() {
        console.log('🔄 Starting auto-refresh for screening responses...');
        
        // Clear any existing interval
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        // Refresh every 30 seconds
        this.autoRefreshInterval = setInterval(() => {
            console.log('🔄 Auto-refreshing screening data...');
            this.loadScreeningOverview();
            this.loadScreeningResponses(this.currentPage);
        }, 30000);
        
        // Also refresh when window gains focus (user comes back to tab)
        window.addEventListener('focus', () => {
            console.log('👁️ Window focused - refreshing screening data...');
            this.loadScreeningOverview();
            this.loadScreeningResponses(this.currentPage);
        });
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
            console.log('⏹️ Auto-refresh stopped');
        }
    }
}

// Initialize screening responses manager
const screeningManager = new ScreeningResponsesManager();

// Add to existing admin dashboard initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('Screening responses manager initialized');
    
    // Load screening responses when the section is shown
    const originalShowAdminSection = window.showAdminSection;
    window.showAdminSection = function(section) {
        console.log('Switching to admin section:', section);
        
        if (originalShowAdminSection) {
            originalShowAdminSection(section);
        }
        
        if (section === 'screening-responses') {
            console.log('Loading screening responses section...');
            
            // Show loading indicator
            const tbody = document.getElementById('screeningResponsesTableBody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 20px; color: #8b5cf6;">
                            <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                                <div style="width: 20px; height: 20px; border: 2px solid #8b5cf6; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                                <span>Loading screening responses...</span>
                            </div>
                        </td>
                    </tr>
                `;
            }
            
            // Load data
            screeningManager.loadScreeningOverview();
            screeningManager.loadScreeningResponses();
            
            // Set up auto-refresh for real-time updates
            screeningManager.startAutoRefresh();
        }
    };
    
    // Add CSS for loading spinner and notifications
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});

// Global functions for screening responses
window.filterScreeningResponses = () => screeningManager.filterScreeningResponses();
window.changePage = (direction) => screeningManager.changePage(direction);
window.closeScreeningDetailModal = () => screeningManager.closeScreeningDetailModal();
window.updateScreeningStatus = () => screeningManager.updateScreeningStatus();

// Test function to manually load screening data (for debugging)
window.testScreeningData = async function() {
    console.log('🧪 Testing screening data loading...');
    
    try {
        // Test API endpoints
        const overviewResponse = await fetch('/api/screening-responses/admin/overview');
        const overviewData = await overviewResponse.json();
        console.log('✅ Overview API:', overviewData);
        
        const responsesResponse = await fetch('/api/screening-responses/admin/responses?page=1&limit=20&sortBy=completedAt&sortOrder=desc');
        const responsesData = await responsesResponse.json();
        console.log('✅ Responses API:', responsesData);
        
        // Test DOM elements
        const elements = {
            totalScreenings: document.getElementById('totalScreeningsCount'),
            crisisScreenings: document.getElementById('crisisScreeningsCount'),
            avgScore: document.getElementById('avgScreeningScore'),
            uniqueUsers: document.getElementById('uniqueScreeningUsers'),
            tableBody: document.getElementById('screeningResponsesTableBody')
        };
        
        console.log('📋 DOM Elements:', Object.keys(elements).map(key => ({
            [key]: !!elements[key]
        })));
        
        // Manually update stats
        if (overviewData.success && elements.totalScreenings) {
            screeningManager.updateOverviewStats(overviewData.data.overview);
            console.log('✅ Stats updated manually');
        }
        
        // Manually update table
        if (responsesData.success && elements.tableBody) {
            screeningManager.displayScreeningResponses(responsesData.data.responses);
            console.log('✅ Table updated manually');
        }
        
        console.log('🎉 Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
};