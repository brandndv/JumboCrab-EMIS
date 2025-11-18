-- CreateEnum
CREATE TYPE "Roles" AS ENUM ('admin', 'generalManager', 'manager', 'supervisor', 'clerk', 'employee');

-- CreateEnum
CREATE TYPE "GENDER" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "CIVIL_STATUS" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "EMPLOYMENT_STATUS" AS ENUM ('REGULAR', 'PROBATIONARY', 'TRAINING');

-- CreateEnum
CREATE TYPE "CURRENT_STATUS" AS ENUM ('ACTIVE', 'ON_LEAVE', 'VACATION', 'SICK_LEAVE', 'INACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "SUFFIX" AS ENUM ('JR', 'SR', 'II', 'III', 'IV');

-- CreateEnum
CREATE TYPE "DEPARTMENT" AS ENUM ('KITCHEN', 'DINING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "role" "Roles" NOT NULL DEFAULT 'employee',
    "isArchived" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleName" TEXT,
    "suffix" "SUFFIX",
    "sex" "GENDER" NOT NULL,
    "civilStatus" "CIVIL_STATUS" NOT NULL,
    "nationality" TEXT,
    "birthdate" TIMESTAMP(3) NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "img" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "isEnded" BOOLEAN DEFAULT false,
    "endDate" TIMESTAMP(3),
    "position" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "employmentStatus" "EMPLOYMENT_STATUS" NOT NULL,
    "currentStatus" "CURRENT_STATUS" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactRelationship" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactEmail" TEXT,
    "description" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");
