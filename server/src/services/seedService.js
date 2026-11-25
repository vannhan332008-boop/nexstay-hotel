import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Resets and seeds the NexStay database to a clean presentation-ready state
 */
export async function resetDemoDatabase() {
  await prisma.conciergeLog.deleteMany();
  await prisma.ioTLog.deleteMany();
  await prisma.folioCharge.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();

  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('Password@123', salt);

  await prisma.user.create({
    data: {
      name: 'Nguyễn Minh Quân (General Manager)',
      email: 'admin@nexstay.com',
      password: defaultPasswordHash,
      role: 'ADMIN',
      phone: '+84 909 888 999',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Trần Bảo Ngọc (Front Desk Lead)',
      email: 'receptionist@nexstay.com',
      password: defaultPasswordHash,
      role: 'RECEPTIONIST',
      phone: '+84 909 777 888',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Lê Thị Thu Hà (Housekeeping Lead)',
      email: 'housekeeping@nexstay.com',
      password: defaultPasswordHash,
      role: 'HOUSEKEEPING',
      phone: '+84 909 666 777',
    },
  });

  const guest1 = await prisma.user.create({
    data: {
      name: 'Nguyễn Thảo Vy',
      email: 'guest1@nexstay.com',
      password: defaultPasswordHash,
      role: 'GUEST',
      phone: '+84 912 345 678',
    },
  });

  const guest2 = await prisma.user.create({
    data: {
      name: 'Alexander Wright',
      email: 'guest2@nexstay.com',
      password: defaultPasswordHash,
      role: 'GUEST',
      phone: '+1 (555) 019-9481',
    },
  });

  await prisma.room.create({
    data: {
      number: '101',
      type: 'Cyber Executive Suite',
      pricePerNight: 280.0,
      basePricePerNight: 280.0,
      yieldMultiplier: 1.0,
      status: 'AVAILABLE',
      floor: 1,
      amenities: '4K OLED Smart TV, Bose Spatial Audio, Nespresso Bar, Wi-Fi 7, Air Purifier',
      smartControls: JSON.stringify({
        lights: false,
        ambientLighting: 'CYAN',
        acTemp: 22,
        curtainsOpen: 30,
        doorLocked: true,
        scene: 'STANDBY',
      }),
    },
  });

  await prisma.room.create({
    data: {
      number: '102',
      type: 'Zen Garden Studio',
      pricePerNight: 165.0,
      basePricePerNight: 165.0,
      yieldMultiplier: 1.0,
      status: 'AVAILABLE',
      floor: 1,
      amenities: 'Bonsai Balcony, Rain Shower, Dyson Hairdryer, Ambient Dimmer',
      smartControls: JSON.stringify({
        lights: false,
        ambientLighting: 'WARM',
        acTemp: 23,
        curtainsOpen: 50,
        doorLocked: true,
        scene: 'STANDBY',
      }),
    },
  });

  const room201 = await prisma.room.create({
    data: {
      number: '201',
      type: 'Neon Deluxe Suite',
      pricePerNight: 215.0,
      basePricePerNight: 195.0,
      yieldMultiplier: 1.1,
      status: 'OCCUPIED',
      floor: 2,
      amenities: 'King Memory Bed, Smart Mirror, Rain Shower, Mini Bar, RGB Ambient Matrix',
      smartControls: JSON.stringify({
        lights: true,
        ambientLighting: 'VIOLET',
        acTemp: 21,
        curtainsOpen: 75,
        doorLocked: true,
        scene: 'CYBER_LOUNGE',
      }),
    },
  });

  const room202 = await prisma.room.create({
    data: {
      number: '202',
      type: 'Neon Deluxe Room',
      pricePerNight: 195.0,
      basePricePerNight: 195.0,
      yieldMultiplier: 1.0,
      status: 'CLEANING',
      floor: 2,
      amenities: 'King Memory Bed, Smart Mirror, Rain Shower, Mini Bar',
      smartControls: JSON.stringify({
        lights: true,
        ambientLighting: 'CYAN',
        acTemp: 24,
        curtainsOpen: 100,
        doorLocked: false,
        scene: 'HOUSEKEEPING',
      }),
    },
  });

  await prisma.room.create({
    data: {
      number: '301',
      type: 'Starlight Panoramic Loft',
      pricePerNight: 385.0,
      basePricePerNight: 350.0,
      yieldMultiplier: 1.1,
      status: 'AVAILABLE',
      floor: 3,
      amenities: 'Glass Ceiling, Saigon River Panorama, Smart Blinds, Jacuzzi, Wine Cellar',
      smartControls: JSON.stringify({
        lights: false,
        ambientLighting: 'CYAN',
        acTemp: 20,
        curtainsOpen: 0,
        doorLocked: true,
        scene: 'STANDBY',
      }),
    },
  });

  const room302 = await prisma.room.create({
    data: {
      number: '302',
      type: 'Quantum Horizon VIP',
      pricePerNight: 460.0,
      basePricePerNight: 420.0,
      yieldMultiplier: 1.1,
      status: 'OCCUPIED',
      floor: 3,
      amenities: 'Private Sky Balcony, Smart Jacuzzi, 85" OLED Cinema, Voice AI Hub',
      smartControls: JSON.stringify({
        lights: true,
        ambientLighting: 'CYAN',
        acTemp: 19,
        curtainsOpen: 85,
        doorLocked: true,
        scene: 'ROMANTIC',
      }),
    },
  });

  const room401 = await prisma.room.create({
    data: {
      number: '401',
      type: 'Apex Royal Penthouse',
      pricePerNight: 850.0,
      basePricePerNight: 750.0,
      yieldMultiplier: 1.13,
      status: 'OCCUPIED',
      floor: 4,
      amenities: 'Infinity Pool, Private Butler, 360° Sky Deck, Soundproof Cinema',
      smartControls: JSON.stringify({
        lights: true,
        ambientLighting: 'GOLD',
        acTemp: 20,
        curtainsOpen: 100,
        doorLocked: true,
        scene: 'VIP_WELCOME',
      }),
    },
  });

  await prisma.room.create({
    data: {
      number: '402',
      type: 'Presidential Cyber Villa',
      pricePerNight: 920.0,
      basePricePerNight: 920.0,
      yieldMultiplier: 1.0,
      status: 'MAINTENANCE',
      floor: 4,
      amenities: 'Helipad Access, Private Gym, Sauna, Holographic Concierge',
      smartControls: JSON.stringify({
        lights: false,
        ambientLighting: 'WARM',
        acTemp: 23,
        curtainsOpen: 0,
        doorLocked: true,
        scene: 'MAINTENANCE',
      }),
    },
  });

  const now = new Date();
  const threeDaysLater = new Date(now.getTime() + 3 * 86400000);
  const twoDaysLater = new Date(now.getTime() + 2 * 86400000);

  await prisma.booking.create({
    data: {
      userId: guest1.id,
      roomId: room201.id,
      checkIn: now,
      checkOut: threeDaysLater,
      totalAmount: 663.0, // 645 room + 18 laundry POS
      paymentStatus: 'COMPLETED',
      paymentMethod: 'VIETQR',
      bookingSource: 'ONLINE',
      digitalKey: 'NEX-KEY-201-9F3A-8B2E',
      guestName: 'Nguyễn Thảo Vy',
      guestPhone: '+84 912 345 678',
      guestIdNumber: '079195004821',
      guestDob: '1995-05-19',
      guestAddress: '128 Nguyễn Huệ, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      guestNationality: 'Việt Nam',
      policeSyncStatus: 'SYNCED',
      policeDeclarationId: 'C06-HCM-20261125-0084',
      isVip: true,
      charges: {
        create: [
          {
            itemName: 'Giặt ủi Siêu Tốc 2h (Express Laundry)',
            category: 'LAUNDRY',
            quantity: 1,
            unitPrice: 18,
            totalPrice: 18,
          },
        ],
      },
    },
  });

  await prisma.booking.create({
    data: {
      userId: guest2.id,
      roomId: room302.id,
      checkIn: now,
      checkOut: twoDaysLater,
      totalAmount: 952.0, // 920 room + 32 breakfast POS
      paymentStatus: 'PENDING',
      paymentMethod: 'VNPAY',
      bookingSource: 'ONLINE',
      digitalKey: 'NEX-KEY-302-7C1D-4E9A',
      guestName: 'Alexander Wright',
      guestPhone: '+1 (555) 019-9481',
      guestIdNumber: 'P89230194',
      guestDob: '1990-11-23',
      guestAddress: '772 Horizon Way, Seattle, WA, USA',
      guestNationality: 'United States',
      policeSyncStatus: 'PENDING',
      isVip: true,
      charges: {
        create: [
          {
            itemName: 'Bữa Sáng Tại Phòng (Floating VIP Breakfast)',
            category: 'DINING',
            quantity: 1,
            unitPrice: 32,
            totalPrice: 32,
          },
        ],
      },
    },
  });

  await prisma.booking.create({
    data: {
      userId: guest1.id,
      roomId: room401.id,
      checkIn: now,
      checkOut: threeDaysLater,
      totalAmount: 2550.0,
      paymentStatus: 'COMPLETED',
      paymentMethod: 'VIETQR',
      bookingSource: 'WALK_IN',
      digitalKey: 'NEX-KEY-401-VIP-9988',
      guestName: 'Phạm Nhật Hoàng (VIP Diamond)',
      guestPhone: '+84 908 111 222',
      guestIdNumber: '001088019482',
      guestDob: '1988-09-02',
      guestAddress: 'Vinhomes Central Park, Bình Thạnh, TP. Hồ Chí Minh',
      guestNationality: 'Việt Nam',
      policeSyncStatus: 'SYNCED',
      policeDeclarationId: 'C06-HCM-20261125-0091',
      isVip: true,
    },
  });

  await prisma.serviceRequest.createMany({
    data: [
      {
        userId: guest1.id,
        roomId: room201.id,
        type: 'CLEANING',
        description: 'Yêu cầu dọn phòng buổi tối & thêm 2 khăn tắm tre cao cấp.',
        status: 'PENDING',
        priority: 'VIP',
      },
      {
        userId: guest2.id,
        roomId: room302.id,
        type: 'ROOM_SERVICE',
        description: 'Bữa Sáng Tại Phòng (Floating VIP Breakfast) x1 ($32)',
        status: 'IN_PROGRESS',
        priority: 'VIP',
      },
      {
        userId: guest1.id,
        roomId: room202.id,
        type: 'CLEANING',
        description: 'Khách vừa check-out, cần vệ sinh chuẩn bị đón khách VIP lúc 14:00.',
        status: 'PENDING',
        priority: 'HIGH',
      },
    ],
  });

  await prisma.ioTLog.createMany({
    data: [
      { roomId: room201.id, device: 'LIGHTS', action: 'SET_SCENE', value: 'CYBER_LOUNGE (VIOLET)', source: 'VOICE_AI' },
      { roomId: room302.id, device: 'AC', action: 'SET_TEMP', value: '19°C', source: 'UI' },
      { roomId: room401.id, device: 'DOOR_LOCK', action: 'UNLOCK', value: 'Biometric QR Verified', source: 'UI' },
      { roomId: room201.id, device: 'CURTAINS', action: 'OPEN_CURTAINS', value: '75%', source: 'VOICE_AI' },
    ],
  });

  await prisma.conciergeLog.createMany({
    data: [
      {
        roomNumber: '201',
        query: 'Cho tôi thêm khăn tắm và gợi ý quán ăn ngon quanh Quận 1 tối nay',
        reply: 'Dạ thưa quý khách Thảo Vy, Nex đã điều phối nhân viên mang thêm khăn tắm lên phòng 201 ngay. Gần khách sạn có Anan Saigon (Michelin) và Sky Bar Bến Bạch Đằng rất tuyệt ạ!',
        actionTriggered: 'SERVICE_REQUEST:TOWELS',
        language: 'vi',
      },
      {
        roomNumber: '302',
        query: 'What time is checkout and can I get late checkout?',
        reply: 'Standard checkout is 12:00 PM. As a VIP Horizon Suite guest, Nex has noted a complimentary 2:00 PM late checkout request for you.',
        actionTriggered: 'INFO:CHECKOUT',
        language: 'en',
      },
    ],
  });

  return {
    roomsSeeded: 8,
    bookingsSeeded: 3,
    timestamp: new Date().toISOString(),
  };
}
